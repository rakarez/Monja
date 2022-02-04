require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require('mongoose-findorcreate');
const app = express();
const path = require('path');
const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'documents')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({storage: storage});
const fs = require('fs');
const moment = require('moment');

app.use(express.static("public"));
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: '664262',
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(("mongodb://localhost:27017/userDB"), {useNewUrlParser: true});

const userSchema = new mongoose.Schema ({
  name: String,
  username: String,
  password: String,
  userType: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

const pengajuanSchema = new mongoose.Schema({
  namaPengajuan: String,
  tanggalPengajuan: Date,
  mak: Number,
  jumlahBiaya: Number,
  bagian: String,
  lampiran: String,
  name: String,
  approvalPPK: Boolean,
  approvalPPSPM: Boolean
}, {collection: 'pengajuan'});

const Pengajuan = new mongoose.model("Pengajuan", pengajuanSchema);

var currentUserName = null;
var currentUserType = null;

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

app.get("/", function(req, res){
  res.render("index");
});

app.get("/admin", function(req, res){
  res.render("admin");
});

app.get("/adminDashboard/user-form", function(req, res){
  if (req.isAuthenticated()){
    res.render("user-form");
  } else {
    res.render("admin");
  }
});

app.get("/adminDashboard",function(req, res){
  if (req.isAuthenticated()){
    User.find({"username":{$ne: null}}, function(err, foundUsers){
      if (err){
        console.log(err);
      } else {
        if (foundUsers){
          res.render("adminDashboard", {foundUsers: foundUsers})
        }
      }
    });
  } else {
    res.redirect("admin");
  }
})

app.get("/adminreg", function(req, res){
  res.render("adminreg");
});

app.post("/admin", function(req, res){
  const user = new User ({
    username: req.body.username,
    password: req.body.password,
    userType: null
  });

  // console.log(user.username);

  req.login (user, function(err){
    if (err){
      console.log(err);
    } else {
      User.findOne({username: user.username}, function(err, foundUser){
        if (err){
          console.log(err);
        } else {
          if (foundUser.userType === "admin"){
            passport.authenticate("local")(req, res, function(){
              res.redirect("/adminDashboard");
            });
          } else {
            res.send("Not Authorized");
          }
        }
      });
    }
  });
});

app.post("/adminreg", function(req, res){
  User.register({username: req.body.username}, req.body.password, function(err, user){
    if (err){
      console.log(err);
      res.redirect("adminreg");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.render("admin");
      });
    }
  });
});

app.post("/adminDashboard/user-form", function(req, res){
  const user = new User ({
    name: req.body.name,
    username: req.body.username,
    userType: req.body.userType
  });

  User.register(user, req.body.password, function (err, user){
    if (err){
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/adminDashboard");
      });
    }
  });
});

app.post("/", function(req, res){
  const user = new User ({
    username: req.body.username,
    password: req.body.password
  });

  User.findOne({username: user.username}, function(err, foundUser){
      if(err){
        console.log(err);
      } else {
        if (foundUser){
          currentUserType = foundUser.userType;
          currentUserName = foundUser.name;
        }
      }
  });

  req.login (user, function(err){
    if (err){
      console.log(err);
    } else {
      passport.authenticate("local", { successRedirect:'/dashboard', failureRedirect: '/' })(req, res, function(){
        res.redirect("/dashboard");
      });
    }
  });
});

app.get("/dashboard", function(req, res){
  if (req.isAuthenticated()){
    res.render("dashboard", {currentUserType: currentUserType, currentUserName: currentUserName});
  } else {
    res.redirect("/");
  }
});

app.get("/adminDashboard/logout", function (req, res){
  req.logout();
  res.redirect("/admin");
});

app.get("/pengajuan-baru", function(req, res){
  if (req.isAuthenticated()){
    res.render("pengajuan-baru", {currentUserType: currentUserType, currentUserName: currentUserName});
    console.log(currentUserName);
  } else {
    res.redirect("/");
  }
});

app.post("/pengajuan-baru", upload.single('document'), function(req, res){
  const pengajuan = new Pengajuan ({
    namaPengajuan: req.body.namaPengajuan,
    tanggalPengajuan: req.body.tanggalPengajuan,
    mak: req.body.MAK,
    jumlahBiaya: req.body.jumlahBiaya,
    bagian: req.body.bagian,
    lampiran: req.file.filename,
    name: currentUserName,
    approvalPPK: null,
    approvalPPSPM: null
  });

  pengajuan.save(function (){
    res.redirect("/tables");
  });
});

// function getDirectoryContent (req, res, next) {
//   fs.readdir('documents', (err, files) => {
//     if (err) return next(err)
//     res.locals.filenames = files
//     next()
//   })
// };
//
// app.get('/files', getDirectoryContent, (req, res) => {
//   res.send({ files: res.locals.filenames })
// });

app.get("/tables", function(req, res){
  if (req.isAuthenticated()){
    switch(currentUserType){
      case "PPK":
        Pengajuan.find({approvalPPK: null}, function(err, foundPengajuan){
          if(err){
            console.log(err);
          } else {
            if(foundPengajuan) {
              res.render("tables", {foundPengajuan: foundPengajuan, moment: moment, currentUserType: currentUserType, currentUserName: currentUserName});
            }
          }
        });
        break;
      case "PPSPM":
        Pengajuan.find({approvalPPK: true, approvalPPSPM: null}, function(err, foundPengajuan){
          if(err){
            console.log(err);
          } else {
            if(foundPengajuan) {
              res.render("tables", {foundPengajuan: foundPengajuan, moment: moment, currentUserType: currentUserType, currentUserName: currentUserName});
            }
          }
        });
        break;
      case "User":
        Pengajuan.find({name: currentUserName}, function(err, foundPengajuan){
          if(err){
            console.log(err);
          } else {
            if(foundPengajuan) {
              res.render("tables", {foundPengajuan: foundPengajuan, moment: moment, currentUserType: currentUserType, currentUserName: currentUserName});
            }
          }
        });
        break;
      case "admin":
          Pengajuan.find({}, function(err, foundPengajuan){
            if(err){
              console.log(err);
            } else {
              if(foundPengajuan) {
                res.render("tables", {foundPengajuan: foundPengajuan, moment: moment, currentUserType: currentUserType, currentUserName: currentUserName});
              }
            }
          });
        break;

    };
  } else {
    res.redirect("/");
  }
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
  currentUserType = null;
});

app.get("/documents/:documents", function(req, res){
  // console.log(req.params.documents);
  const file = __dirname + "\\documents\\" + req.params.documents;
  res.download(file);
});

app.get("/approval-ppk-:document_id", function (req, res){
  let document_id = req.params.document_id;
  if (req.isAuthenticated()){
    Pengajuan.findById(document_id, function(err,foundPengajuan){
      if(err){
        console.log(err);
      } else {
        if(foundPengajuan){
          // console.log(foundPengajuan);
          res.render("approval-ppk", {foundPengajuan: foundPengajuan, currentUserType: currentUserType, currentUserName: currentUserName, moment: moment});
        }
      }
    });
  } else {
    res.redirect("/");
  }
});

app.post("/approval-ppk-:document_id", function(req, res){
  if (req.isAuthenticated()){
    Pengajuan.findByIdAndUpdate(req.params.document_id, {approvalPPK: req.body.approval}, function (err, docs){
      if (err){
        console.log(err);
      } else {
        res.redirect("/tables");
      }
    });
  } else {
    res.redirect("/");
  }
});

app.get("/approval-ppspm-:document_id", function (req, res){
  let document_id = req.params.document_id;
  if (req.isAuthenticated()){
    Pengajuan.findById(document_id, function(err,foundPengajuan){
      if(err){
        console.log(err);
      } else {
        if(foundPengajuan){
          // console.log(foundPengajuan);
          res.render("approval-ppspm", {foundPengajuan: foundPengajuan, currentUserType: currentUserType, currentUserName: currentUserName, moment: moment});
        }
      }
    });
  } else {
    res.redirect("/");
  }
});

app.post("/approval-ppspm-:document_id", function(req, res){
  if (req.isAuthenticated()){
    Pengajuan.findByIdAndUpdate(req.params.document_id, {approvalPPSPM: req.body.approval}, function (err, docs){
      if (err){
        console.log(err);
      } else {
        res.redirect("/tables");
      }
    });
  } else {
    res.redirect("/");
  }
});

app.listen(3000, function(){
  console.log("Server started on port 3000");
});

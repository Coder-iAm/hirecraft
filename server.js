const express = require("express");
const fs = require("fs");
const app = express();
const path = require('path');
const session = require("express-session");
const fetch = require('node-fetch');
require('dotenv').config();
const mysql = require('mysql2');
const multer = require("multer");
const puppeteer = require("puppeteer");
const { profile } = require("console");
const PDFParser = require("pdf2json");
const mammoth = require('mammoth');


app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const port = 3000;



const img = path.join(__dirname, 'img');
app.use('/img', express.static(img));

const uploadDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadDir));

const PdfResume = path.join(__dirname, 'PDFResume');
app.use('/PDFResume', express.static(PdfResume));

const teampic = path.join(__dirname, 'team_pic');
app.use('/team_pic', express.static(teampic));

app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));



const API_URL = 'https://hirecraftchat.loca.lt/api/chat';

const caCert = fs.readFileSync(path.join(__dirname, process.env.DB_SSL_CA));

const connection = mysql.createConnection({
    host: process.env.DB_HOST, // Your Aiven MySQL host from .env
    port: process.env.DB_PORT, // The port provided by Aiven from .env
    user: process.env.DB_USER, // Your Aiven user from .env
    password: process.env.DB_PASSWORD, // Your Aiven password from .env
    database: process.env.DB_NAME, // Your Aiven database name from .env
    ssl: {
      ca: caCert
    }
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database: ', err);
    } else {
        console.log('Connected to the database.');
    }
});



const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, "uploads");
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `profile-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({ storage });






//SERVER START

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/main-page.html");
});

app.get("/signin", (req, res) => {
    res.sendFile(__dirname + "/signin.html");
});


app.post("/user-entry", (req, res) => {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;

    // Step 1: Check if user exists
    const checkQuery = 'SELECT * FROM usersinfo WHERE email = ? AND password = ?';
    connection.query(checkQuery, [email, password], (err, results) => {
        if (err) {
            console.error("Error checking user:", err);
            return res.json({ invalid: "error" });
        }

        if (results.length > 0) {


            res.json({ exists: "User already exists" });
        }

        else {

            const insertQuery = 'INSERT INTO usersinfo (name, email, password) VALUES (?, ?, ?)';
            connection.query(insertQuery, [name, email, password], (err, result) => {
                if (err) {
                    console.error("Error inserting user:", err);
                    return res.json({ invalid: "error" });
                }

                req.session.user = email;

                res.json({ success: "User inserted and session started" });
            });
        }
    });
});




app.post("/user-login", (req, res) => {
    const email = req.body.email;
    const password = req.body.password;


    const loginQuery = 'SELECT * FROM usersinfo WHERE email = ? AND password = ?';
    connection.query(loginQuery, [email, password], (err, results) => {
        if (err) {
            console.error("Error checking login:", err);
            return res.json({ error: "Internal server error" });
        }

        if (results.length > 0) {

            req.session.user = email;
            res.json({ success: "Login successful" });
        } else {
            // Invalid login
            res.json({ err: "Invalid email or password" });
        }
    });
});




app.get("/dashboard", (req, res) => {
    if (req.session.user) {

        if (req.session.filename) {
            const file = req.session.filename;

            const filePath = path.join(__dirname, "PDFResume", file);
            fs.unlink(filePath, () => { });
        }

        res.sendFile(__dirname + "/dashboard.html");
    }
    else {
        res.redirect("/signin");
    }
});


app.get("/building", (req, res) => {
    if (req.session.user) {
        res.sendFile(__dirname + "/building.html");
    }
    else {
        res.redirect("/signin");
    }
});



app.get("/user-list", (req, res) => {
    if (req.session.user) {
        const email = req.session.user;

        connection.query(
            "SELECT name, email FROM usersinfo WHERE email = ?",
            [email],
            (err, results) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: "Database error" });
                }

                if (results.length === 0) {
                    return res.status(404).json({ success: false, message: "User not found" });
                }

                res.json({ success: true, user: results[0] });
            }
        );
    } else {
        res.status(403).json({ success: false, message: "Unauthorized" });
    }
});





app.post("/template", (req, res) => {

    try {
        req.session.template = req.body.temp;
        console.log(req.session.template);
        res.json({ success: true });
    }
    catch {
        res.json({ error: true });
    }

});





app.get("/ats-checker", (req, res) => {
    if (req.session.user) {
        res.sendFile(__dirname + "/ats-page.html");
    }
    else {
        res.redirect("/signin");
    }
});

app.post("/ai-enchanced", (req, res) => {


    const profile = req.body.profile;




    const chatInput = `Only Rewrite the following as a resume summary. Remove all personal pronouns and greetings. Keep it formal, professional, and within *130 words must. Do not change facts.Text: '${profile}'`;


    const userInput = chatInput.toString();
   

        fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chat: userInput,
            
          })
        }).then(response => response.json())
        .then(data => {
            return res.json({ success: true, output: data.output });
        })
        .catch(err => {
            return res.json({ error: true });
        });


        

  

});



app.post("/ai-enchanced-other", (req, res) => {


    const newedu = req.body.newedu;
    console.log(newedu);

    const wordCount = newedu.split(/\s+/).filter(word => word.length > 0).length;

    const chatInput = `Rewrite the following as a professional resume work experience entry, expanding it with more formal and descriptive language without changing original facts, no personal pronouns, formal tone, use bullet points or commas: '${newedu}'`;


    const userInput = chatInput.toString();
    
    fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat: userInput,
          
        })
      }).then(response => response.json())
      .then(data => {
          return res.json({ success: true, output: data.output });
      })
      .catch(err => {
          return res.json({ error: true });
      });

});




app.post("/create-resume", upload.single("profilePic"), (req, res) => {

    const profilePicPath = req.file.path;

    const {
        name,
        phone,
        email,
        dob,
        address,
        profile,
        languages,
        hobbies,
        skills,
        education,
        work_experience,
        academic_projects,
        achievements
    } = req.body;

    let hobbies_edited = ``;
    let skills_edited = ``;
    let academic_projects_edited = ``;
    let achievements_edited = ``;
    let experience_edited = ``;
    let education_edited = ``;

    if (Array.isArray(skills)) {

        let skills_array = skills;


        for (let i = 0; i < skills_array.length; i++) {
            skills_edited += `<div>○ ${skills_array[i]} <div class="bar-container"><div class="skill-bar" style="width: 35%;"></div></div></div>`;
        }

    } else {
        skills_edited += `<div>○ ${skills} <div class="bar-container"><div class="skill-bar" style="width: 35%;"></div></div></div>`;
    }

    if (Array.isArray(hobbies)) {

        let hobbies_array = hobbies;


        for (let i = 0; i < hobbies_array.length; i++) {
            hobbies_edited += `○ ${hobbies_array[i]}<br>`;
        }

    } else {
        hobbies_edited += `○ ${hobbies}<br>`;
    }

    if (Array.isArray(academic_projects)) {

        let academic_projects_array = academic_projects;


        for (let i = 0; i < academic_projects_array.length; i++) {
            academic_projects_edited += ` <p>○ ${academic_projects_array[i]}</p>`;
        }

    } else {
        academic_projects_edited += ` <p>○ ${academic_projects}</p>`;
    }


    if (Array.isArray(achievements)) {

        let achievements_array = achievements;


        for (let i = 0; i < achievements_array.length; i++) {
            achievements_edited += ` <p>○ ${achievements_array[i]}</p>`;
        }

    } else {
        achievements_edited += ` <p>○ ${achievements}</p>`;
    }

    if (Array.isArray(work_experience)) {

        let experience_array = work_experience;


        for (let i = 0; i < experience_array.length; i++) {
            experience_edited += ` <p>○ ${experience_array[i]}</p>`;
        }

    } else {
        experience_edited += ` <p>○ ${work_experience}</p>`;
    }

    if (Array.isArray(education)) {

        let education_array = education;


        for (let i = 0; i < education_array.length; i++) {
            education_edited += ` <p>○ ${education_array[i]}</p>`;
        }

    } else {
        education_edited += ` <p>○ ${education}</p>`;
    }

    //generate pdf
    async function generatePDF() {
       
        const usertemp = `${req.session.template}.html`;
        let html = fs.readFileSync(path.join(__dirname, usertemp), "utf8");


        const imagePath = profilePicPath;
        const imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });
        const imageDataUri = `data:image/jpeg;base64,${imageBase64}`;


        html = html.replace(/uploads\/profile.jpg/g, imageDataUri);

        html = html.replace("{{profile}}", profile);

        html = html.replace("{{phone}}", phone);

        html = html.replace("{{email}}", email);

        html = html.replace("{{date-of-birth}}", dob);

        html = html.replace("{{address}}", address);

        html = html.replace("{{languages}}", languages);

        html = html.replace("{{hobbies}}", hobbies_edited);

        html = html.replace("{{name}}", name);

        html = html.replace("{{education}}", education_edited);

        html = html.replace("{{experience}}", experience_edited);

        html = html.replace("{{academic-projects}}", academic_projects_edited);

        html = html.replace("{{achievements}}", achievements_edited);

        html = html.replace("{{skills}}", skills_edited);

       

        const uniqueFilename = `Resume_${Date.now()}.pdf`;
        const pdfPath = path.join(__dirname, "PDFResume", uniqueFilename);

      fetch('https://hirecraftchat.loca.lt/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/html',
        },
        body: html, 
      })
        .then((res) => res.json())
        .then((data) => {
         
          const pdfBuffer = Buffer.from(Object.values(data));
      
          fs.writeFileSync(pdfPath, pdfBuffer);
          console.log('PDF file saved successfully:', pdfPath);

          fs.unlink(profilePicPath, (err) => {
            if (err) console.error("Error deleting uploaded image:", err);
            else console.log("Uploaded profile image deleted successfully.");
        });
        console.log("PDF saved as Resume.pdf");
        req.session.filename = uniqueFilename;
        res.json({ success: true, file: uniqueFilename });
        console.log(req.session);

        })
        .catch((err) => {
          console.error('Error:', err);
          res.status(500).json({ success: false, message: 'Failed to generate PDF' });
        });
        
        

    }

    generatePDF();


});


app.get('/download', (req, res) => {
    if (req.session.user) {
        const file = req.session.filename;
        console.log(file);
        res.download(__dirname + `/PDFResume/${file}`);
    }
    else {
        res.redirect("/");
    }
});







app.post('/check-ats', upload.single('resume'), (req, res) => {


    const filePath = __dirname + "/uploads/" + req.file.filename; // or 'sample.pdf'

    const ext = path.extname(filePath);

    if (ext === '.pdf') {
        const pdfParser = new PDFParser();

        // Parse the PDF when it's ready
        pdfParser.on("pdfParser_dataReady", (pdfData) => {
            // Extract text from all pages of the PDF
            
            const text = pdfData.Pages.map((page) =>
                page.Texts.map((t) => decodeURIComponent(t.R[0].T)).join(" ")
            ).join(" ");

            const singleLineText = text.replace(/\n+/g, ' ').trim();
 console.log(singleLineText);
            const chatInput = `Now give an ATS score (0 - 100)* must and mention writing the mistakes of resume.Keep it within *30 Words* must::'${singleLineText}'`;





            const userInput = chatInput.toString();

        

            try {


                fetch(API_URL, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      chat: userInput,
                      
                    })
                  }).then(response => response.json())
                  .then(data => {
                    const output = data.output;

                    // Match only a two-digit score (not 3 digits like 100)
                    const match = output.match(/(\b\d{2}\b)([\s\S]*)/);
    
                    if (match) {
                        const score = match[1];          // Only the 2-digit number
                        const afterText = match[2].replace(/%|\*|100|[(),\/\\]/g, ' ').trim();
    
    console.log(score,afterText);
                        fs.unlink(filePath, () => { });
    
                        res.json({ success: true, score: score, text: afterText });
                    } else {
                        console.log("reupload run");
                        
                        res.json({ reupload: true });
                    }
                      
                  })
                  .catch(err => {
                      return res.json({ error: true });
                  });



            } catch (error) {
                console.error("PDF parsing error:", error.message);
                res.json({ error: true });
            }
        });
        pdfParser.on("pdfParser_dataError", (err) => {
            console.error("PDF parse error:", err.parserError);
            res.json({ error: true });
        });

        
        pdfParser.loadPDF(filePath);

    
    } else if (ext === '.docx') {
        mammoth.extractRawText({ path: filePath }).then(result => {
            const singleLineText = result.value.replace(/\n+/g, ' ').trim();

            const chatInput = `Now give an ATS score (0 - 100)* must and mention writing the mistakes of resume.Keep it within *30 Words* must::'${singleLineText}'`;





            const userInput = chatInput.toString();
            try {
                fetch(API_URL, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      chat: userInput,
                      
                    })
                  }).then(response => response.json())
                  .then(data => {
                    const output = data.output;

                    // Match only a two-digit score (not 3 digits like 100)
                    const match = output.match(/(\b\d{2}\b)([\s\S]*)/);
    
                    if (match) {
                        const score = match[1];          // Only the 2-digit number
                        const afterText = match[2].replace(/%|\*|100|[(),\/\\]/g, ' ').trim();
    
    console.log(score,afterText);
                        fs.unlink(filePath, () => { });
    
                        res.json({ success: true, score: score, text: afterText });
                    } else {
                        console.log("reupload run");
                        
                        res.json({ reupload: true });
                    }
                      
                  })
                  .catch(err => {
                      return res.json({ error: true });
                  });


            } catch (error) {
                res.json({ error: true });
            }
        });
    } else {
        res.json({ error: true });
    }


});



app.get("/about", (req, res) => {
    if (req.session.user) {
        res.sendFile(__dirname + "/about.html");
    }
    else {
        res.redirect("/signin");
    }
});

app.get("/terms", (req, res) => {
    if (req.session.user) {
        res.sendFile(__dirname + "/terms.html");
    }
    else {
        res.redirect("/signin");
    }
});


app.get("/privacy", (req, res) => {
    if (req.session.user) {
        res.sendFile(__dirname + "/privacy.html");
    }
    else {
        res.redirect("/signin");
    }
});


app.get('/signout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Logout failed');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

app.listen(port, () => {

    console.log("Server is running on port:3000");
})



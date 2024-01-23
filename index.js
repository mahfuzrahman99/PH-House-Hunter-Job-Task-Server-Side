const express = require("express");
const bcrypt = require("bcrypt");
const morgan = require("morgan");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
// Morgan middleware
app.use(morgan("dev"));
app.use(
  cors({
    origin: ["http://localhost:5173", ""],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "One unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "Tow unauthorized access" });
    }
    console.log("Value In The Token", decoded);
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.efkktro.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "30d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          //   sameSite: "none",
        })
        .send({ success: true });
    });

    // clear cookies after logOut user
    app.post("/logOut", async (req, res) => {
      const user = req.body;
      console.log("logOut user", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // Create a user collection
    const usersCollection = client.db("HouseHunter").collection("users");
    const housesCollection = client.db("HouseHunter").collection("houses");
    const bookedHousesListCollection = client
      .db("HouseHunter")
      .collection("bookedHousesList");

    // Registration route
    app.post("/users", async (req, res) => {
      // Validate input data
      try {
        const { fullName, role, phoneNumber, email, password } = req.body;
        if (!fullName || !role || !phoneNumber || !email || !password) {
          return res.status(400).send({ error: "Please fill in all fields" });
        }
        // Check if email already exists
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(400).send({ error: "Email already exists" });
        }
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a JWT token
        const token = jwt.sign(
          { email: email },
          process.env.ACCESS_TOKEN_SECRET,
          {
            expiresIn: "30d",
          }
        );

        // Create a new user document
        const newUser = {
          fullName,
          role,
          phoneNumber,
          email,
          password: hashedPassword,
        };

        // Insert the new user document
        const result = await usersCollection.insertOne(newUser);
        res
          .cookie("token", token, { httpOnly: true, secure: true })
          .send({ token, userData: newUser });
      } catch (error) {
        res.send(error);
      }
    });

    app.get("/loggedInUser", verifyToken, async (req, res) => {
      const email = req.user?.email;
      console.log(email);
      const filter = { email: email };
      const result = await usersCollection.findOne(filter);
      res.send(result);
    });

    // Login route
    app.post("/login", async (req, res) => {
      // Validate input data
      // console.log("loggin route");
      const { email, password } = req.body;

      console.log(email, password);

      if (!email || !password) {
        return res.status(400).send({ error: "Please fill in all fields" });
      }

      // Find the user by email
      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(401).send({ error: "Invalid email or password" });
      }

      // Compare the password

      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (!isPasswordMatch) {
        return res.status(401).send({ error: "Invalid email or password" });
      }

      // Create a JWT token
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        {
          expiresIn: "30d",
        }
      );

      // Return the JWT token
      res.cookie("token", token, { httpOnly: true, secure: true }).send({
        userData: user,
        success: true,
        token: token,
      });
    });
    // add house get all
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // add house get specific id
    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // add house post
    app.post("/houses", async (req, res) => {
      try {
        const newHouse = req.body;
        const result = await housesCollection.insertOne(newHouse);
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });
    // add house get all
    app.get("/houses", async (req, res) => {
      try {
        const result = await housesCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });
    // add house get specific id
    app.get("/houses/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await housesCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });
    // update house
    app.patch("/houses/:id", verifyToken, async (req, res) => {
      try {
        const filter = { _id: new ObjectId(req.params.id) };
        const updatesHouse = req.body;
        const product = {
          $set: {
            name: updatesHouse.name,
            address: updatesHouse.address,
            city: updatesHouse.city,
            bedrooms: updatesHouse.bedrooms,
            bathrooms: updatesHouse.bathrooms,
            room_size: updatesHouse.room_size,
            availability_date: updatesHouse.availability_date,
            image: updatesHouse.image,
            rent_per_month: updatesHouse.rent_per_month,
            description: updatesHouse.description,
            phone_number: updatesHouse.phone_number,
            isBooked: updatesHouse.isBooked,
          },
        };
        const result = await housesCollection.updateOne(filter, product, {
          upsert: true,
        });
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });
    app.patch("/bookHouses/:id", verifyToken, async (req, res) => {
      try {
        const filter = { _id: new ObjectId(req.params.id) };
        console.log(filter);
        const updatesHouse = req.body;
        const product = {
          $set: {
            isBooked: updatesHouse.isBooked,
            userEmail: updatesHouse.userEmail,
          },
        };
        const result = await housesCollection.updateOne(filter, product, {
          upsert: true,
        });
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });
    app.patch("/bookedHouses/:id", verifyToken, async (req, res) => {
      try {
        const filter = { _id: new ObjectId(req.params.id) };
        console.log('paramsId', req.params.id);
        const updateHouse = req.body; 
        console.log('updated body', updateHouse)
        const houses = {
          $set: {
            isBooked: updateHouse.isBooked,
          },
        };
        const result = await housesCollection.updateOne(filter, houses);
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });
    // Deleting House data
    app.delete("/houses/:id", verifyToken, async (req, res) => {
      try {
        const query = { _id: new ObjectId(req.params.id) };
        const result = await housesCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });

    // add house post
    app.post("/bookedHousesList", async (req, res) => {
      try {
        const newHouse = req.body;
        const result = await bookedHousesListCollection.insertOne(newHouse);
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });
    // add house get all
    app.get("/bookedHousesList", verifyToken, async (req, res) => {
      try {
        const result = await bookedHousesListCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });
    // add house get specific id
    app.get("/bookedHousesList/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await bookedHousesListCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });
    // Deleting House data
    app.delete("/bookedHousesList/:id", verifyToken, async (req, res) => {
      try {
        const query = { _id: new ObjectId(req.params.id) };
        const result = await bookedHousesListCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping tDo confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, (req, res) => {
  console.log(`Server running on port ${port}`);
});
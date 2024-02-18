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
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://auth-moha-milon-c8f5f.web.app",
      "https://house-hunter-mahfuz-99.surge.sh"
    ],
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
        expiresIn: "1000h",
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
            expiresIn: "1000h",
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
          .cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
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
      const { email, password } = req.body;

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
          expiresIn: "100h",
        }
      );
      // Return the JWT token
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          // secure: process.env.NODE_ENV === "production",
          sameSite: "None",
          // sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({
          userData: user,
          success: true,
          // token: token,
        });
    });
    // Logout
    app.delete("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: true,
          // secure: process.env.NODE_ENV === "production",
          sameSite: "None",
          // sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send("Logged out successfully");
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

    // pagination
    app.get("/api/allHouses", async (req, res) => {
      try {
        let query = {};

        const queryParams = req.query;

        if (queryParams.limit) {
          const result = await housesCollection
            .find(query)
            .skip(parseInt(queryParams.skip))
            .limit(parseInt(queryParams.limit))
            .toArray();
          return res.send(result);
        }

        if (queryParams.city) {
          query.city = new RegExp(queryParams.city, "i");
        }

        if (queryParams.bedrooms) {
          // query.bedrooms = { $lte: queryParams.bedrooms };
          query.bedrooms = parseInt(queryParams.bedrooms);
        }

        if (queryParams.bathrooms) {
          query.bathrooms = parseInt(queryParams.bathrooms);
        }

        if (queryParams.roomSize) {
          query.room_size = parseInt(queryParams.roomSize);
        }

        if (queryParams.minPrice && queryParams.maxPrice) {
          query.rent_per_month = {
            $lte: parseInt(queryParams.maxPrice),
            $gte: parseInt(queryParams.minPrice),
          };
        }

        console.log(query);
        const result = await housesCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.send(error);
      }
    });

    app.get("/api/houseCount", async (req, res) => {
      const result = await housesCollection.estimatedDocumentCount();
      res.send({ count: result });
    });

    // Define your API endpoint for getting the total count of houses
    app.get("/api/houseCount", async (req, res) => {
      const db = client.db(dbName);
      const collection = db.collection("houses"); // Use your actual collection name

      try {
        const count = await collection.countDocuments();
        res.json({ count });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
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
    app.patch("/houses/:id", async (req, res) => {
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
    app.patch("/bookHouses/:id", async (req, res) => {
      try {
        const filter = { _id: new ObjectId(req.params.id) };
        const updatesHouse = req.body;
        console.log(filter, updatesHouse);
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
    app.patch("/bookedHouses/:id", async (req, res) => {
      try {
        const filter = { _id: new ObjectId(req.params.id) };
        console.log("paramsId", req.params.id);
        const updateHouse = req.body;
        console.log("updated body", updateHouse);
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
    app.delete("/houses/:id", async (req, res) => {
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
    app.get("/bookedHousesList", async (req, res) => {
      try {
        const result = await bookedHousesListCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });
    // add house get specific id
    app.get("/bookedHousesList/:id", async (req, res) => {
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
    app.delete("/bookedHousesList/:id", async (req, res) => {
      try {
        const query = { _id: new ObjectId(req.params.id) };
        const result = await bookedHousesListCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
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

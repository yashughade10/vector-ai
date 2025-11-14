import { connectDB, getTables } from "./src/config/connection";
import { app } from "./app";
import dotenv from "dotenv";

dotenv.config({
    path: "./.env"
});

connectDB()
    .then(() => {
        app.listen(process.env.PORT, () => {
            console.log(`Server is running on port ${process.env.PORT}`);
        })
    })
    .catch((error) => {
        console.log("Error in DB connection", error);
    })
import express from "express"
import dotenv from "dotenv"

dotenv.config()

const app = express()
const PORT = process.env.PORT!
app.use(express.json())



app.get("/health" , (req, res)=>{
    res.json({
        message:"api is working"
    })
})

app.post("/api/chat/stream", (req , res)=>{

})


app.listen(PORT , ()=>{
    console.log(` server is running on http://localhost:${PORT}`)
})
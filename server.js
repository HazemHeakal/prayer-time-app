const express = require("express");
const axios = require("axios");
const { Calendar, Event } = require("ics");
const app = express();
const PORT = 3000;

// Middleware for parsing JSON
app.use(express.json());
app.use(express.static("public"));

// Fetch prayer times from Aladhan API
app.post("/api/prayer-times", async (req, res) => {
    const { latitude, longitude } = req.body;
    const apiUrl = `https://api.aladhan.com/v1/calendar?latitude=${latitude}&longitude=${longitude}&method=5`;

    try {
        const response = await axios.get(apiUrl);
        const data = response.data.data;

        // Generate iCal file
        const events = data.map(day => {
            const date = day.date.gregorian.date.split("-");
            return Object.entries(day.timings).map(([prayer, time]) => {
                const [hours, minutes] = time.split(" ")[0].split(":");
                return {
                    title: prayer,
                    start: [parseInt(date[0]), parseInt(date[1]), parseInt(date[2]), parseInt(hours), parseInt(minutes)],
                };
            });
        }).flat();

        const calendar = new Calendar();
        events.forEach(event => {
            calendar.events.push(new Event(event));
        });

        // Send iCal file or URL as response
        res.json({ iCalFile: calendar.toString() });
    } catch (error) {
        res.status(500).json({ error: "Error fetching prayer times or generating iCal file." });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

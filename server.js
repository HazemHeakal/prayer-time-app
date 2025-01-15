const express = require('express');
const axios = require('axios');
const { createEvents } = require('ics');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

require('dotenv').config();
const GEOCODING_API_KEY = process.env.GEOCODING_API_KEY;
const PRAYER_TIMES_API = 'https://api.aladhan.com/v1/calendar';

app.use(express.json());
app.use(express.static('public')); // Serve static files from the "public" directory

// POST route to generate prayer times for the entire year
app.post('/api/prayer-times', async (req, res) => {
    const { location, year = new Date().getFullYear() } = req.body;

    try {
        // Step 1: Get latitude and longitude
        const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GEOCODING_API_KEY}`;
        const geocodingResponse = await axios.get(geocodingUrl);

        if (!geocodingResponse.data.results.length) {
            return res.status(404).json({ error: 'Location not found!' });
        }

        const { lat, lng } = geocodingResponse.data.results[0].geometry.location;

        // Step 2: Fetch prayer times for the entire year
        const events = [];
        for (let month = 1; month <= 12; month++) {
            const prayerTimesUrl = `${PRAYER_TIMES_API}?latitude=${lat}&longitude=${lng}&method=5&month=${month}&year=${year}`;
            const prayerResponse = await axios.get(prayerTimesUrl);
            const data = prayerResponse.data.data;

            data.forEach((day) => {
                const [dayOfMonth, month, year] = day.date.gregorian.date.split('-').map(Number);

                const validDate = new Date(year, month - 1, dayOfMonth); // Validate date
                if (
                    validDate.getFullYear() !== year ||
                    validDate.getMonth() + 1 !== month ||
                    validDate.getDate() !== dayOfMonth
                ) {
                    console.error(`Invalid date detected: ${day.date.gregorian.date}`);
                    return; // Skip invalid date
                }

                Object.entries(day.timings).forEach(([prayer, time]) => {
                    const [hours, minutes] = time.split(' ')[0].split(':');
                    events.push({
                        title: prayer,
                        start: [year, month, dayOfMonth, parseInt(hours), parseInt(minutes)],
                        description: `${prayer} time in ${location}`,
                    });
                });
            });
        }

        // Step 3: Create iCal events
        createEvents(events, (error, value) => {
            if (error) {
                console.error(error);
                res.status(500).send('Error generating calendar events');
                return;
            }

            // Step 4: Save iCal file temporarily and return its URL
            const timestamp = Date.now();
            const fileName = `prayer-times-${timestamp}.ics`;
            const filePath = path.join(__dirname, 'public', fileName);

            fs.writeFileSync(filePath, value); // Save iCal file temporarily

            res.json({
                message: 'iCal file generated successfully!',
                downloadURL: `${req.protocol}://${req.get('host')}/${fileName}`,
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong!' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
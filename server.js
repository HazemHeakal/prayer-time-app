const express = require('express');
const axios = require('axios');
const { createEvents } = require('ics');
const app = express();
const PORT = 3000;

require('dotenv').config();
const GEOCODING_API_KEY = process.env.GEOCODING_API_KEY;
const PRAYER_TIMES_API = 'https://api.aladhan.com/v1/calendar';

app.use(express.json());
app.use(express.static('public'));

app.post('/api/prayer-times', async (req, res) => {
    const { location } = req.body;

    try {
        // Step 1: Get latitude and longitude
        const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GEOCODING_API_KEY}`;
        const geocodingResponse = await axios.get(geocodingUrl);

        if (!geocodingResponse.data.results.length) {
            return res.status(404).json({ error: 'Location not found!' });
        }

        const { lat, lng } = geocodingResponse.data.results[0].geometry.location;

        // Step 2: Fetch prayer times
        const prayerTimesUrl = `${PRAYER_TIMES_API}?latitude=${lat}&longitude=${lng}&method=5`;
        const prayerResponse = await axios.get(prayerTimesUrl);
        const data = prayerResponse.data.data;

        // Step 3: Generate iCal events
        const events = data.map((day) => {
            const date = day.date.gregorian.date.split('-');
            return Object.entries(day.timings).map(([prayer, time]) => {
                const [hours, minutes] = time.split(' ')[0].split(':');
                return {
                    title: prayer,
                    start: [parseInt(date[0]), parseInt(date[1]), parseInt(date[2]), parseInt(hours), parseInt(minutes)],
                    description: `${prayer} time in ${location}`,
                };
            });
        }).flat();

        // Step 4: Create iCal events
        createEvents(events, (error, value) => {
            if (error) {
                console.error(error);
                res.status(500).send('Error generating calendar events');
                return;
            }

            res.json({ iCalFile: value });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong!' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
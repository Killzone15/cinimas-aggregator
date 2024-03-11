const express = require('express');
const path = require('path');
const app = express();
const bodyParser = require('body-parser');
const http = require('http');
const https = require('https'); // Import the 'https' module
const puppeteer = require('puppeteer');
const fs = require("fs/promises");
const asyncLock = require('async-lock');
const transliteration = require('transliteration');

const port = process.env.PORT || 3000;
const host = process.env.YOUR_HOST || '0.0.0.0';

app.use(express.static(__dirname));
app.use(bodyParser.json());

app.listen(port, host, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/static/recommend.html'));
});

app.get('/search', function (req, res) {
    res.sendFile(path.join(__dirname + '/static/search.html'));
});

app.get('/watch', function (req, res) {
    res.sendFile(path.join(__dirname + '/static/watch.html'));
});

let browser; // Declare a variable to store the Puppeteer browser instance
let lastActivityTime = Date.now(); // Variable to track the last activity time

// Middleware to update the last activity time on every incoming request
app.use((req, res, next) => {
    lastActivityTime = Date.now();
    next();
});

const lock = new asyncLock();
app.post('/create_recommendation', async (req, res) => {
    try {
        // Get the JSON data from the request body
        const jsonData = req.body;

        if (!jsonData || typeof jsonData !== 'object') {
            throw new Error('Invalid JSON data');
        }

        const latinizedTitle = transliterateTitle(jsonData.content_title);
        let key;

        const contentDataFolder = path.join(__dirname, 'data', 'content_data');
        const contentTitleFilePath = path.join(contentDataFolder, `data_${latinizedTitle}.json`);

        // Check if the file for this content title exists
        const contentTitleFileExists = await fs.access(contentTitleFilePath).then(() => true).catch(() => false);

        // Use a lock to synchronize access to the contentTitleFilePath file
        await lock.acquire(`fileLock_data_${latinizedTitle}`, async () => {
            key = generate4LetterString()

            if (!contentTitleFileExists) {
                // File doesn't exist, create the file and add the new data to it
                await fs.writeFile(contentTitleFilePath, JSON.stringify({ [key]: jsonData }, null, 2));
            } else {
                // File already exists, read existing data
                const existingContentTitleData = await fs.readFile(contentTitleFilePath, 'utf-8');
                let existingData;

                try {
                    // Try to parse the existing data as JSON
                    existingData = JSON.parse(existingContentTitleData);
                    console.log(existingData)
                } catch (error) {
                    // If parsing fails, initialize with an empty object
                    existingData = {};
                }

                // Add the new data to the existing object using the generated key
                existingData[key] = jsonData;

                // Write the updated data back to the file
                await fs.writeFile(contentTitleFilePath, JSON.stringify(existingData, null, 2));
            }
        });

        // Construct the result string
        const resultString = `${req.protocol}://${req.get('host')}/watch?content=${latinizedTitle}&variant=${key}`;

        res.status(200).json({ message: 'Data saved successfully.', resultString });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/get-recommendation', (req, res) => {
    const content = req.query.content;
    const variant = req.query.variant;

    if (content && variant) {
        const filePath = path.join(__dirname, 'data', 'content_data', `data_${content}.json`);

        fs.readFile(filePath, 'utf-8')
            .then(data => {
                const jsonData = JSON.parse(data);
                const contentData = jsonData[variant];

                // Send the content data back to the client
                res.json(contentData);
            })
            .catch(error => {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
            });
    } else {
        res.status(400).json({ error: 'Invalid parameters' });
    }
});

app.get('/proxy', async (req, res) => {
    const externalPageURL = req.query.url; // Get the URL from the query parameter

    try {
        if (!browser) {
            browser = await puppeteer.launch({
                executablePath: '/usr/bin/chromium-browser',
                args: ['--no-sandbox'],
            })
        }

        const page = await browser.newPage();

        // Set a custom user agent
        await page.setUserAgent('Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');

        // Navigate to the external page
        await page.goto(externalPageURL, { waitUntil: 'networkidle2' });

        // Get the final HTML content after JavaScript execution
        const finalHTML = await page.content();

        // Send the final HTML as the response
        res.send(finalHTML);
    } catch (err) {
        console.error('Error during proxy request:', err);
        res.status(500).send('Error during proxy request');
    }
});

// Schedule a task to check for inactivity and close the browser after 10 seconds
setInterval(() => {
    const inactiveTime = Date.now() - lastActivityTime;
    if (inactiveTime >= 10000 && browser) {
        browser.close();
        browser = null;
    }
}, 1000); // Check every second for inactivity

app.get('/kp-api', async (req, res) => {
    try {
        const queryParam = req.query.queryParam;

        const url = 'https://graphql.kinopoisk.ru/graphql/?operationName=HdSuggestSearchOnline';
        const body = {
            operationName: 'HdSuggestSearchOnline',
            variables: {
                onlySearchable: false,
                onlyAvailableMe: false,
                keyword: queryParam,
                limit: 6,
            },
            query: 'query HdSuggestSearchOnline($keyword: String!, $limit: Int, $onlySearchable: Boolean = false, $onlyAvailableMe: Boolean = false) { suggest(keyword: $keyword) { movies(limit: $limit, isOnline: true, onlySearchable: $onlySearchable, onlyAvailableMe: $onlyAvailableMe) { items { movie { ...HdSuggestMovieItem __typename } __typename } __typename } __typename } } fragment HdSuggestMovieItem on Movie { id contentId title { ...Title __typename } rating { kinopoisk { isActive value __typename } __typename } ott { contentGroupUuid __typename } gallery { posters { vertical(override: OTT_WHEN_EXISTS) { avatarsUrl fallbackUrl __typename } verticalWithRightholderLogo { avatarsUrl fallbackUrl __typename } __typename } __typename } viewOption { buttonText isAvailableOnline: isWatchable(filter: {anyDevice: false, anyRegion: false}) purchasabilityStatus contentPackageToBuy { billingFeatureName __typename } optionMonetizationModels availabilityAnnounce { groupPeriodType announcePromise availabilityDate type __typename } __typename } ... on Film { type productionYear(override: OTT_WHEN_EXISTS) __typename } ... on TvSeries { releaseYears { end start __typename } __typename } ... on TvShow { releaseYears { end start __typename } __typename } ... on MiniSeries { releaseYears { end start __typename } __typename } __typename } fragment Title on Title { localized original __typename } '
        };

        const headers = {
            'authority': 'graphql.kinopoisk.ru',
            'accept': '*/*',
            'accept-language': 'ru,en;q=0.9',
            'content-type': 'application/json',
            'cookie': '_yasc=Gapq1OEKcuPwZkrsuBPAExj6OGcC1j7HtaSd4EkYfIq3S/FOPkfsaTKSP//3NJiz; gdpr=0; ya_sess_id=noauth:1696893887; sessar=1.1182.CiBWdZYiNZLDCCH9ZyRBB8ndFo3OSltGnqD8svn08Uo-Zg.bApzhBoPcHbj7xDyFat6vUQjk67dGQ8pfB0o1KOBiCc; yandex_login=; ys=c_chck.2502530913; i=CoCvgDfZpdI0eMdmb2fWem7SMY1/TMqcPd5Qu15syEBBskEsCHgw6/A/28cmJ62lFZPRRWDSE9xKNz0iGHLB9c+VOSA=; yandexuid=2926880661696893887; mda2_beacon=1696893887031; _ym_uid=1696893886311480253; _ym_d=1696893888; _ym_isad=1; sso_status=sso.passport.yandex.ru:synchronized_no_beacon; _ym_visorc=b',
            'origin': 'https://hd.kinopoisk.ru',
            'referer': 'https://hd.kinopoisk.ru/',
            'sec-ch-ua': '"Google Chrome";v="117", "Not;A=Brand";v="8", "Chromium";v="117"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'service-id': '25',
            'uber-trace-id': 'f8a19da0d074d1a9:1ae00f1fe4a1fb1e:0:1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
            'x-kp-testids': '436979,625129,669455,669491,671636,699647,700843,713700,735368,778142,812169,834967,835808,846755,863622,864468,866761,874448,882343,884279,885677',
            'x-preferred-language': 'ru',
            'x-request-id': '1696893887492374-12510092005872610368-f4acf00f82c2d1b9',
            'x-search-request-id': '678443279493876601696893898706',
        };

        const method = 'POST';

        const response = await fetch(url, {
            method,
            headers,
            body: JSON.stringify(body),
        });

        const data = await response.json();

        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/kp-api-content-info', async (req, res) => {
    try {
        const contentId = req.query.queryParam;

        const url = 'https://graphql.kinopoisk.ru/graphql/?operationName=FilmContent';
        const body = {
            operationName: 'FilmContent',
            variables: {
                episodeNumber: 0,
                seasonNumber: 0,
                withPrechosenEpisode: false,
                contentUuid: contentId,
                isAuthorized: false,
                withSerialStructure: true,
                isSliderDown: false,
            },
            query: 'query FilmContent($contentUuid: String!, $isAuthorized: Boolean!, $withSerialStructure: Boolean!, $isSliderDown: Boolean!, $withPrechosenEpisode: Boolean!, $episodeNumber: Int!, $seasonNumber: Int!) { movieByContentUuid(contentUuid: $contentUuid) { id contentId ...MovieTitle gallery { logos { horizontal { avatarsUrl origSize { width height __typename } __typename } rightholderForCoverRecommendedTheme __typename } posters { vertical(override: OTT_WHEN_EXISTS) { avatarsUrl fallbackUrl __typename } verticalWithRightholderLogo { avatarsUrl fallbackUrl __typename } __typename } __typename } ...AgeRestriction ...OverviewMeta ...ContentOverview ...ContentDetails ...ContentCard ...SerialStructure @include(if: $withSerialStructure) ...MovieSeoInfo @skip(if: $isSliderDown) ...SchemaOrgVideoObject @skip(if: $isSliderDown) ...PrechosenEpisode @include(if: $withPrechosenEpisode) ...MainTrailer ...Promo __typename } webPage @skip(if: $isSliderDown) { ...MovieWebPage __typename } } fragment MovieTitle on Movie { title { ...Title __typename } __typename } fragment Title on Title { localized original __typename } fragment AgeRestriction on Movie { restriction { age __typename } __typename } fragment OverviewMeta on Movie { contentId __typename rating { kinopoisk { value count isActive __typename } __typename } ott { preview { ...OttPreviewFeatures ... on OttPreview_AbstractVideo { duration __typename } __typename } __typename } top10 top250 genres { id name __typename } restriction { age __typename } countries { name __typename } userData @include(if: $isAuthorized) { voting { value __typename } __typename } viewOption { ...AvailabilityViewOption __typename } ... on Film { productionYear(override: OTT_WHEN_EXISTS) __typename } ... on MiniSeries { releaseYears { start end __typename } __typename } ... on TvSeries { releaseYears { start end __typename } __typename } ... on TvShow { releaseYears { start end __typename } __typename } ... on Video { productionYear(override: OTT_WHEN_EXISTS) __typename } } fragment OttPreviewFeatures on OttPreview { features(filter: {layout: OTT_TITLE_CARD, onlyClientSupported: true}) { alias displayedName: displayName group __typename } __typename } fragment AvailabilityViewOption on ViewOption { watchabilityStatus availabilityAnnounce { __typename } __typename } fragment ContentOverview on Movie { shortDescription editorAnnotation userData @include(if: $isAuthorized) { watchStatuses { watched { value __typename } __typename } __typename } ott { ... on Ott_AbstractVideo { preview { ... on OttPreview_AbstractVideo { duration __typename } __typename } __typename } __typename } __typename } fragment ContentDetails on Movie { id contentId title { original __typename } ottSynopsis: synopsis(override: OTT_WHEN_EXISTS) actors: members(limit: 10, role: [ACTOR, CAMEO, UNCREDITED]) { items { person { id name originalName __typename } __typename } __typename } directors: members(role: DIRECTOR, limit: 5) { items { person { id name originalName __typename } __typename } __typename } ott { preview { ...OttPreviewFeatures availableMetadata { audio subtitles __typename } __typename } __typename } rating { kinopoisk { value isActive count __typename } __typename } userData @include(if: $isAuthorized) { voting { value __typename } __typename } viewOption { ...AvailabilityViewOption __typename } top250 __typename } fragment ContentCard on Movie { gallery { covers { horizontal { avatarsUrl __typename } __typename } logos { rightholderForCoverRecommendedTheme __typename } __typename } ott { ... on Ott_AbstractVideo { skippableFragments { ...SkippableFragment __typename } __typename } __typename } __typename } fragment SkippableFragment on SkippableFragment { type startTime endTime final __typename } fragment SerialStructure on Series { seasons(limit: 10000, isOnlyOnline: true) { items { contentId number episodes(limit: 0, isOnlyOnline: true) { total __typename } episodeGroupings(filter: {onlyOnline: true}, capacity: 20) { from to offset __typename } __typename } __typename } __typename } fragment MovieSeoInfo on Movie { id title { localized original __typename } shortDescription synopsis genres { id name slug __typename } countries { id name __typename } viewOption { isAvailableOnline: isWatchable(filter: {anyDevice: false, anyRegion: false}) __typename } watchabilityCount: watchability(limit: 0) { total __typename } ott { preview { features(filter: {layout: OTT_TITLE_CARD, onlyClientSupported: true}) { alias __typename } __typename } __typename } ... on VideoInterface { duration kpProductionYear: productionYear(override: DISABLED) ottProductionYear: productionYear(override: OTT_WHEN_EXISTS) __typename } ... on Series { releaseYears { start end __typename } seasonsAll: seasons(limit: 0) { total __typename } seasonsOnline: seasons(limit: 0, isOnlyOnline: true) { total __typename } __typename } __typename } fragment SchemaOrgVideoObject on Movie { id title { localized original __typename } ottSynopsis: synopsis(override: OTT_WHEN_EXISTS) gallery { posters { vertical(override: OTT_WHEN_EXISTS) { avatarsUrl fallbackUrl __typename } __typename } __typename } ott { promoTrailers: trailers(onlyPromo: true, limit: 1) { items { streamUrl __typename } __typename } __typename } ... on Film { duration productionYear(override: OTT_WHEN_EXISTS) __typename } ... on Video { duration productionYear(override: OTT_WHEN_EXISTS) __typename } ... on TvSeries { releaseYears { start end __typename } seriesDuration __typename } ... on MiniSeries { releaseYears { start end __typename } seriesDuration __typename } ... on TvShow { releaseYears { start end __typename } seriesDuration __typename } __typename } fragment PrechosenEpisode on Series { episode(episodeNumber: $episodeNumber, seasonNumber: $seasonNumber) { contentId season { contentId __typename } ott { duration timing @include(if: $isAuthorized) { current __typename } viewOption { availabilityStatus watchabilityStatus __typename } __typename } offsetInSeason(filter: {onlyOnline: true}) __typename } __typename } fragment MainTrailer on Movie { contentId ott { mainTrailers: trailers(limit: 2) { items { contentGroupUuid main __typename } __typename } __typename } __typename } fragment Promo on Movie { contentId ott { promos: trailers(limit: 1, onlyPromo: true) { items { contentGroupUuid __typename } __typename } __typename } __typename } fragment MovieWebPage on WebPageContext { ottFilmPage(contentGroupUuid: $contentUuid) { htmlMeta { openGraph { image { avatarsUrl __typename } __typename } __typename } __typename } __typename } ',
        };

        const headers = {
            'authority': 'graphql.kinopoisk.ru',
            'accept': '*/*',
            'accept-language': 'ru,en;q=0.9',
            'content-type': 'application/json',
            'cookie': '_yasc=Gapq1OEKcuPwZkrsuBPAExj6OGcC1j7HtaSd4EkYfIq3S/FOPkfsaTKSP//3NJiz; gdpr=0; ya_sess_id=noauth:1696893887; sessar=1.1182.CiBWdZYiNZLDCCH9ZyRBB8ndFo3OSltGnqD8svn08Uo-Zg.bApzhBoPcHbj7xDyFat6vUQjk67dGQ8pfB0o1KOBiCc; yandex_login=; ys=c_chck.2502530913; i=CoCvgDfZpdI0eMdmb2fWem7SMY1/TMqcPd5Qu15syEBBskEsCHgw6/A/28cmJ62lFZPRRWDSE9xKNz0iGHLB9c+VOSA=; yandexuid=2926880661696893887; mda2_beacon=1696893887031; _ym_uid=1696893886311480253; _ym_d=1696893888; _ym_isad=1; sso_status=sso.passport.yandex.ru:synchronized_no_beacon; _ym_visorc=b',
            'origin': 'https://hd.kinopoisk.ru',
            'referer': 'https://hd.kinopoisk.ru/',
            'sec-ch-ua': '"Google Chrome";v="117", "Not;A=Brand";v="8", "Chromium";v="117"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'service-id': '25',
            'uber-trace-id': 'f8a19da0d074d1a9:1ae00f1fe4a1fb1e:0:1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
            'x-kp-testids': '436979,625129,669455,669491,671636,699647,700843,713700,735368,778142,812169,834967,835808,846755,863622,864468,866761,874448,882343,884279,885677',
            'x-preferred-language': 'ru',
            'x-request-id': '1696893887492374-12510092005872610368-f4acf00f82c2d1b9',
            'x-search-request-id': '678443279493876601696893898706',
        };

        const method = 'POST';

        const response = await fetch(url, {
            method,
            headers,
            body: JSON.stringify(body),
        });

        const data = await response.json();

        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/unofficial-kp-api-get-content-info', async (req, res) => {
    const contentId = req.query.id;

    const apiKey = 'd6e77714-af14-44c4-a40b-25b74e86efaa';
    const apiUrl = `https://kinopoiskapiunofficial.tech/api/v2.2/films/${contentId}`;

    const headers = {
        'authority': 'kinopoiskapiunofficial.tech',
        'accept': 'application/json',
        'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'cookie': '_ym_uid=1694530095650453109; _ym_d=1705098241; _ym_isad=1; _ym_visorc=w',
        'referer': 'https://kinopoiskapiunofficial.tech/documentation/api/',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'x-api-key': apiKey,
    };

    try {
        const response = await fetch(apiUrl, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/premier-api', async (req, res) => {
    try {
        const queryParam = req.query.queryParam; // Get the query parameter from the URL

        // Make a request to the Premier One API with the required headers
        const apiUrl = `https://premier.one/app/v1.2/search?query=${queryParam}&page=1&picture_type=banner&system=hwi_vod_id&is_active=1&device=web`;
        const randomDeviceId = generateUUID();

        const response = await fetch(apiUrl, {
            method: 'GET', // Specify the HTTP method
            headers: {
                'X-Device-Id': randomDeviceId,
                'X-Device-Type': 'browser'
            }
        });

        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.status}`);
        }

        const data = await response.json();

        // Send the extracted data as a response
        res.json(data);
    } catch (error) {
        // Handle errors here
        console.error('Error:', error);
        res.status(500).json({ error: 'An error occurred' });
    }
});

app.get('/premier-api-get-seasons', async (req, res) => {
    try {
        const contentSlug = req.query.contentSlug; // Get the contentSlug from the query parameter

        // Make a request to the Premier One API with the required headers
        const api_url = `https://beta.premier.one/uma-api/metainfo/tv/${contentSlug}/season/?picture_type=banner&device=web&platform=browser&system=hwi_vod_id`;
        const randomDeviceId = generateUUID();

        const response = await fetch(api_url, {
            method: 'GET',
            headers: {
                'X-Device-Id': randomDeviceId,
                'X-Device-Type': 'browser'
            }
        });

        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.status}`);
        }

        const seasons = await response.json();

        // Extract the season numbers
        const season_numbers = seasons.map(season => ({ number: season.number }));

        res.json(season_numbers);
    } catch (error) {
        // Handle errors here
        console.error('Error:', error);
        res.status(500).json({ error: 'An error occurred' });
    }
});

app.get('/premier-api-get-poster/:metainfo', async (req, res) => {
    const metainfo = req.params.metainfo;
    const posterUrl = await getVerticalPosterFromMetainfoPremier(metainfo);
    res.json({ posterUrl });
});

async function getVerticalPosterFromMetainfoPremier(metainfo) {
    try {
        const response = await fetch(metainfo);

        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.status}`);
        }

        const xmlString = await response.text();
        var jsonData = JSON.parse(xmlString);

        var cardGroupUrl = jsonData.pictures.card_group;

        if (cardGroupUrl) {
            return cardGroupUrl;
        } else {
            // If <card_group> element is not found, return an empty string or handle accordingly
            return '';
        }
    } catch (error) {
        console.error('Error:', error);
        return '';
    }
}


function generateUUID() {
    // Generate a version 4 (random) UUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (Math.random() * 16) | 0,
            v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Function to generate a 4-letter string
function generate4LetterString() {
    const characters = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function transliterateTitle(contentTitle) {
    return transliteration.transliterate(contentTitle).replace(/\s+/g, '_');
}

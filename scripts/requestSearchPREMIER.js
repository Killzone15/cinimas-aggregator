function requestSearchPREMIER(queryParam) {
    return new Promise(async (resolve, reject) => {
        try {
            const apiUrl = `/premier-api?queryParam=${queryParam}`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status}`);
            }

            const data = await response.json();

            // Assuming extractFieldsPremier is an asynchronous function that returns the extracted data
            const extractedData = await extractFieldsPremier(data.results);
            console.log("premier");
            console.log(extractedData);

            // Resolve the promise with the extracted data
            resolve(extractedData);
        } catch (error) {
            // Reject the promise with the error
            reject(error);
        }
    });
}

async function extractFieldsPremier(data) {
    const extractedData = [];

    for (const item of data) {
        const button_text = item.labels.some(label => label.name === "Бесплатно")
            ? "Смотреть бесплатно"
            : "Смотреть по подписке";

        const extractedItem = {
            title: item.name || null,
            rating: item.rating?.kinopoisk || null,   // почему это здесь?
            country: item.countries?.[0] || null,
            seasons: item.type.serial_content
                ? { start: item.year_start, end: item.year_end }
                : null,
            content_paid_types: item.content_paid_types || null,
            share_link: item.id ? `https://premier.one/show/${item.id}` : null,
            theatre: "premier",
            slug: item.slug || null,
            button_text: button_text,
            metainfo: item.absolute_url
        };

        if (item.type.serial_content) {
            extractedItem.seasons = {
                start: item.year_start,
                end: item.year_end,
            };
        }

        if (extractedItem.seasons !== null) {
            extractedItem.seasons = await fetchSeasonsDataPremier(extractedItem.slug);
        }

        extractedItem.poster = await makeRequestForPremierPoster(extractedItem.metainfo)

        extractedData.push(extractedItem);
    }

    return extractedData;
}

async function fetchSeasonsDataPremier(contentSlug) {
    try {
        const response = await fetch(`/premier-api-get-seasons?contentSlug=${contentSlug}`);

        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.status}`);
        }
        const seasons = await response.json();
        try {
            const season_numbers = seasons.map(season => ({ number: season.number }));
            return season_numbers;
        } catch (error) {
            // If there's an error or no season numbers are present, return an empty array
            return [];
        }
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

async function makeRequestForPremierPoster(metainfoUrl) {
    try {
        const response = await fetch(`/premier-api-get-poster/${encodeURIComponent(metainfoUrl)}`);

        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.status}`);
        }

        const data = await response.json();
        const posterUrl = data.posterUrl;

        return posterUrl

    } catch (error) {
        console.error('Error:', error);
    }
}
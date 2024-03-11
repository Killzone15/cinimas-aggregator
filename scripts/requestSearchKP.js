function requestSearchKP(queryParam) {
    return new Promise(async (resolve, reject) => {
        try {
            const encodedQueryParam = encodeURIComponent(queryParam);
            const apiUrl = `/kp-api?queryParam=${encodedQueryParam}`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status}`);
            }

            const data = await response.json();

            // Assuming extractFieldsKinopoisk is an asynchronous function that returns the extracted data
            const extractedData = await extractFieldsKinopoisk(data.data.suggest.movies.items);

            // Resolve the promise with the extracted data
            resolve(extractedData);
        } catch (error) {
            // Reject the promise with the error
            reject(error);
        }
    });
}

async function extractFieldsKinopoisk(data) {
    const extractedData = [];

    for (const item of data) {
        const poster = (item.movie.gallery.posters.vertical.avatarsUrl + "/960x960") || null;
        const title = item.movie.title.localized || null;
        const rating = item.movie.rating.kinopoisk.value || null;
        const content_paid_types = item.movie.viewOption.optionMonetizationModels || null;
        const content_id = item.movie.contentId;
        const share_link = "https://hd.kinopoisk.ru/film/" + content_id;
        const theatre = "kinopoisk";

        let seasons_release_years = null;
        let seasons = null;

        if (item.movie.releaseYears) {
            seasons_release_years = item.movie.releaseYears.map(year => {
                return {
                    start: year.start || null,
                    end: year.end || null
                };
            });

            seasons = await getSeasons(content_id); // Wait for the seasons to resolve
        }

        const button_text = determine_button_text(content_paid_types);

        const extractedItem = {
            poster,
            title,
            rating,
            country: null, // Kinopoisk data doesn't contain country information
            seasons_release_years,
            seasons,
            content_paid_types,
            content_id,
            share_link,
            theatre,
            button_text
        };

        extractedData.push(extractedItem);
    }

    return extractedData;
}


function determine_button_text(service_list) {
    const has_avod = service_list.includes("AVOD");
    const has_svod = service_list.includes("SVOD");
    const has_est = service_list.includes("EST");
    const has_tvod = service_list.includes("TVOD");

    if (has_avod) {
        return "Смотреть бесплатно";
    } else if (has_svod && !has_avod) {
        return "Смотреть по подписке";
    } else if (has_est && !has_avod) {
        return "Купить";
    } else if (has_svod && has_est && !has_avod) {
        return "Смотреть по подписке или купить";
    } else if (has_tvod && !has_avod) {
        return "Купить";
    } else {
        return "Смотреть";
    }
}

async function getSeasons(contentId) {
    try {
        const url = '/kp-api-content-info?queryParam=' + contentId;

        const headers = {
            Accept: '*/*',
            'Content-Type': 'application/json',
            'Sec-Ch-Ua': '"Google Chrome";v="117", "Not;A=Brand";v="8", "Chromium";v="117"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'Service-Id': '25',
            'Uber-Trace-Id': '116776566969b749:1ff03b941201d59a:0:1',
        };

        const method = 'GET';

        const response = await fetch(url, {
            method,
            headers,
        });

        const data = await response.json();

        // Extract the seasons from the JSON response
        if (data && data.data && data.data.movieByContentUuid && data.data.movieByContentUuid.seasons) {
            const seasons = data.data.movieByContentUuid.seasons.items;
            const season_numbers = seasons.map(season => ({ number: season.number }));
            return season_numbers;
        }

        // Return an empty array if the structure is not as expected
        return [];
    } catch (error) {
        console.error('Error:', error);
        return { error: 'Internal Server Error' };
    }
}

function requestSearchOKKO(queryParam) {
    return new Promise(async (resolve, reject) => {
        try {
            const apiUrl = `https://ctx.playfamily.ru/screenapi/v1/noauth/groupedsearch/web/1?fromPage=mainKino&keyword=${queryParam}`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status}`);
            }

            const data = await response.json();

            // Assuming extractFieldsOKKO is an asynchronous function that returns the extracted data
            const extractedData = await extractFieldsOKKO(data);


            console.log("okko");
            console.log(extractedData);

            // Resolve the promise with the extracted data
            resolve(extractedData);
        } catch (error) {
            // Reject the promise with the error
            reject(error);
        }
    });
}

async function extractFieldsOKKO(data) {
    const extractedData = [];

    const items = data.element?.collectionItems?.items[0]?.element?.collectionItems?.items || [];

    for (const item of items) {
        const button_text =
            item.element.cheapestProduct.consumptionMode === "DTO" ? "Купить" :
                item.element.playbackAvailabilityType === "AVOD" ? "Смотреть бесплатно" :
                    "Смотреть по подписке";

        const extractedItem = {
            title: item.element.name || null,
            poster: (item.element?.basicCovers?.items || []).find(cover => cover.imageType === 'PORTRAIT')?.url || null,
            rating: item.element.averageRating || null,
            country: item.element.country || null,
            seasons: item.element.seasonsCount || null,
            content_paid_types: item.element.playbackAvailabilityType || null,
            cheapest_product: item.element.cheapestProduct.consumptionMode || null,
            share_link: item.element.alias ? `https://okko.tv/movie/${item.element.alias}` : null,
            theatre: "okko",
            button_text: button_text
        };

        if (extractedItem.seasons !== null) {
            extractedItem.seasons = await fetchSeasonsDataOKKO(extractedItem);
        }

        extractedData.push(extractedItem);
    }

    return extractedData;
}

async function fetchSeasonsDataOKKO(extractedItem) {
    const url = extractedItem.share_link;
    const proxyUrl = `/proxy?url=${encodeURIComponent(url)}` + "?sso=false";

    try {
        // Step 1: Get the page text using /proxy
        const pageText = await fetch(proxyUrl).then((response) => response.text());

        // Step 2: Extract seasons data using okko_get_seasons_data_from_page
        const seasonsData = await okko_get_seasons_data_from_page(pageText);

        return seasonsData;
    } catch (error) {
        throw new Error(`Error fetching seasons data: ${error.message}`);
    }
}

async function okko_get_seasons_data_from_page(text) {
    try {
        const pattern = /season\/(\d+)">/g;
        const matches = [...text.matchAll(pattern)];
        const uniqueElements = [...new Set(matches.map(match => match[1]))];
        const data = uniqueElements.map(number => ({ number: parseInt(number) }));
        return data;
    } catch (error) {
        console.error(error);
    }
}

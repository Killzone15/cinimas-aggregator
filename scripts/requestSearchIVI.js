// script.js


function requestSearchIVI(queryParam) {
    return new Promise(async (resolve, reject) => {
        try {
            const apiUrl = `https://api2.ivi.ru/mobileapi/search/v7/?app_version=870&query=${queryParam}`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status}`);
            }

            const data = await response.json();

            // Assuming extractFieldsIVI is an asynchronous function that returns the extracted data
            const extractedData = await extractFieldsIVI(data.result);

            // Resolve the promise with the extracted data
            resolve(extractedData);
        } catch (error) {
            // Reject the promise with the error
            reject(error);
        }
    });
}

function extractFieldsIVI(dataArray) {
    // Initialize an array to store the extracted data
    const extractedData = [];

    // Iterate through each element in the dataArray
    dataArray.forEach(item => {
        // Extract the desired fields or set them to null if they don't exist
        const extractedItem = {
            title: item.title || null,
            poster: (item.posters && item.posters.length > 0) ? (item.posters[0].url || null) : null,
            rating: item.ivi_rating_10 || null,
            country: item.country || null,
            content_paid_types: item.content_paid_types || null,
            share_link: item.share_link || null,
            theatre: "ivi"
        };

        // Filter out seasons with 'fake' set to true
        if (item.seasons && item.seasons.length > 0) {
            const filteredSeasons = item.seasons.filter(season => season.fake !== true);
            extractedItem.seasons = filteredSeasons;
        }

        // Determine the button text using the provided function
        extractedItem.button_text = determineButtonText(extractedItem.content_paid_types);

        // Add the extracted item to the result array
        extractedData.push(extractedItem);
    });

    return extractedData;
}

function determineButtonText(serviceList) {
    const hasAVOD = serviceList.includes("AVOD");
    const hasSVOD = serviceList.includes("SVOD");
    const hasEST = serviceList.includes("EST");
    const hasTVOD = serviceList.includes("TVOD");

    if (hasAVOD) {
        return "Смотреть бесплатно";
    } else if (hasSVOD && !hasAVOD) {
        return "Смотреть по подписке";
    } else if (hasEST && !hasAVOD) {
        return "Купить";
    } else if (hasSVOD && hasEST && !hasAVOD) {
        return "Смотреть по подписке или купить";
    } else if (hasTVOD && !hasAVOD) {
        return "Купить";
    } else {
        return "Смотреть";
    }
}
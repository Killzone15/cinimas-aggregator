document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-bar');

    function handleSearch(queryParam) {
        if (queryParam !== '') {
            const loadingSpinner = document.getElementById('loading-spinner');
            loadingSpinner.style.display = 'block'; // Show the loading spinner

            // Create an array of promises for each request
            const promises = [
                requestSearchIVI(queryParam),
                requestSearchKP(queryParam),
                requestSearchOKKO(queryParam),
                requestSearchPREMIER(queryParam)
            ];

            // Use Promise.all to wait for all promises to resolve
            Promise.all(promises)
                .then(responses => {
                    // Combine JSON data from all responses
                    const json_ivi = responses[0];
                    const json_kp = responses[1];
                    const json_okko = responses[2];
                    const json_pr = responses[3];

                    // Combine all data into a single array
                    const combinedData = [...json_ivi, ...json_kp, ...json_okko, ...json_pr];

                    const threshold = 25;
                    const sortedData = customSortNew(combinedData, queryParam, threshold);

                    // Hide the loading spinner
                    loadingSpinner.style.display = 'none';

                    // Generate blocks with the final JSON data
                    console.log(sortedData);
                    generateBlocks(sortedData);
                })
                .catch(error => {
                    // Hide the loading spinner in case of an error
                    loadingSpinner.style.display = 'none';

                    // Handle errors here
                    console.error('Error:', error);
                });
        }
    }


     // Check if there is a query parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('search');

    if (queryParam && queryParam.trim() !== '') {
        // If a query parameter exists in the URL, search with it
        handleSearch(queryParam);
    }

    function searchStart(){
        //Hide searchButton
        searchButton.style.display = 'none';
         // Clear the existing search result blocks
         const blockContainer = document.getElementById('block-container');
         blockContainer.innerHTML = '';
         const queryParam = searchInput.value.trim();
         handleSearch(queryParam);
    }

    searchInput.addEventListener('keyup', event => {
        if (event.key === 'Enter') {
           searchStart();
        }
    });

    // Handler for changing the contents of a text field
    searchInput.addEventListener('input', () => {
    // Check if the value in the text field is empty
    if (searchInput.value.trim() !== '') {
        // If it is not empty, we show the "Find" button
        searchButton.style.display = 'inline-block';
        searchCleanButton.style.display = 'inline-block';
    } else {
        // If empty, hide the "Find" button
        searchButton.style.display = 'none';
        searchCleanButton.style.display = 'none';
    }
});
    
     // Event click on searchButton
     searchButton.addEventListener('click', () => {
         searchStart();
    });
    //Event click on cross svg 
    searchCleanButton.addEventListener('click', () => {
        searchInput.value = "";
        searchButton.style.display = 'none';
        searchCleanButton.style.display = 'none';
   });
});

function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = a.charAt(j - 1) === b.charAt(i - 1) ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return matrix[b.length][a.length];
}

function containsSimilarWord(text, expectedWord) {
    // Remove symbols from the text
    const textWithoutSymbols = text.replace(/[^\p{L}\d\s]+/gu, ' ');

    // Split the text without symbols into an array of words
    const words = textWithoutSymbols.split(/\s+/);

    // Function to check if two words are similar with a difference of 1 or 2 letters
    function isSimilar(word1, word2) {
        let differences = 0;
        for (let i = 0; i < word1.length; i++) {
            if (word1[i] !== word2[i]) {
                differences++;
                if (differences > 2) {
                    return false;
                }
            }
        }

        return differences >= 1;
    }

    // Check each word in the array
    for (const word of words) {
        if (isSimilar(word, expectedWord)) {
            return true;
        }
    }

    return false;
}

function customSortOriginal(combinedData, queryParam, threshold) {
    const sortedData = combinedData.sort((a, b) => {
        const distanceA = levenshteinDistance(a.title, queryParam);
        const distanceB = levenshteinDistance(b.title, queryParam);

        // Check if the title contains a word similar to queryParam
        const containsSimilarWordA = containsSimilarWord(a.title.toLowerCase(), queryParam.toLowerCase());
        const containsSimilarWordB = containsSimilarWord(b.title.toLowerCase(), queryParam.toLowerCase());

        // Prioritize titles that contain a word similar to queryParam
        if (containsSimilarWordA && !containsSimilarWordB) {
            return -1;
        } else if (!containsSimilarWordA && containsSimilarWordB) {
            return 1;
        }

        // If both titles contain a word similar to queryParam, sort based on Levenshtein distance
        if (distanceA <= threshold && distanceB <= threshold) {
            return distanceA - distanceB;
        }

        // If either item is too dissimilar, don't change their order
        return 0;
    });

    return sortedData;
}

function customSortNew(data, queryParam) {
    const queryLower = queryParam.toLowerCase();

    // Step 1: Separate titles containing queryParam (matching whole words)
    const matchingTitles = data.filter(item => {
        const titleLower = item.title.toLowerCase().replace(/[^\p{L}\d\s]+/gu, ' ');
        return titleLower.includes(queryLower) &&
            titleLower.split(' ').some(word => word === queryLower);
    });

    // Step 2: Sort matching titles by rating (consider N/A as lowest rating)
    matchingTitles.sort((a, b) => {
        const ratingA = a.rating !== undefined && a.rating !== null ? a.rating : Number.NEGATIVE_INFINITY;
        const ratingB = b.rating !== undefined && b.rating !== null ? b.rating : Number.NEGATIVE_INFINITY;
        return ratingB - ratingA;
    });

    // Step 3: Create a map to store unique titles and their corresponding items with different ratings
    const titleMap = new Map();
    matchingTitles.forEach(item => {
        const titleKey = item.title.toLowerCase();
        if (!titleMap.has(titleKey)) {
            titleMap.set(titleKey, [item]);
        } else {
            titleMap.get(titleKey).push(item);
        }
    });

    // Step 4: Flatten the map values to create the final array
    const result = Array.from(titleMap.values()).flat();

    // Step 5: Find the set difference between data and matchingTitles
    const remainingTitles = data.filter(item => !matchingTitles.includes(item));

    // Step 6: Concatenate the two lists
    const finalResult = [...result, ...remainingTitles];

    return finalResult;
}












function generateBlocks(jsonDataList) {
    const blockContainer = document.getElementById('block-container');

    // Clear the existing blocks
    blockContainer.innerHTML = '';

    jsonDataList.forEach(data => {
        const block = generateBlock(data);
        blockContainer.appendChild(block);
    });
}


// Function to generate a block based on JSON data
function generateBlock(data) {
    const blockContainer = document.getElementById('block-container');

    // Create a new div element for the block
    const block = document.createElement('div');
    block.className = 'block';

    // Set the 'theatre' custom attribute
    block.setAttribute('theatre', data.theatre);

    // Create elements for the block content
    const titleElement = document.createElement('div');
    titleElement.className = 'title';
    titleElement.textContent = data.title || 'N/A';

    // Create logo for theatre
    const theatreLogo = document.createElement('div');
    theatreLogo.className = 'logo';
    theatreLogo.innerHTML = `<image>`;

    const posterElement = document.createElement('div');
    posterElement.className = 'poster';

    // Create image element for the poster
    const posterImage = document.createElement('img');
    posterImage.src = data.poster || 'placeholder.jpg'; // Use data.poster.url if available
    posterImage.alt = 'Poster';
    posterImage.width = 200;
    posterImage.height = 300;
    posterElement.appendChild(posterImage);

    // Create a new div element for the block
    const contentInfo = document.createElement('div');
    contentInfo.className = 'content-info';

    const ratingElement = document.createElement('div');
    ratingElement.id = 'info';
    ratingElement.className = 'rating';
    ratingElement.textContent = `Рейтинг: ${data.rating || 'N/A'}`;

    //const countryElement = document.createElement('div');
    //countryElement.id = 'info';
    //countryElement.className = 'country';
    //countryElement.textContent = `Страна: ${data.country || 'N/A'}`;

    const paidTypesElement = document.createElement('div');
    paidTypesElement.id = 'info';
    paidTypesElement.className = 'paid-types';
    paidTypesElement.textContent = `Подписка: ${data.button_text || 'N/A'}`;

    const linkElement = document.createElement('div');

    // Create anchor element for the link
    const linkAnchor = document.createElement('a');
    linkAnchor.className = 'link'
    linkAnchor.href = data.share_link || '#';
    linkAnchor.textContent = `${data.button_text || 'Смотреть'}`;
    linkAnchor.target = '_blank';
    linkElement.appendChild(linkAnchor);

    // Append the content elements to the block
    block.appendChild(theatreLogo);
    block.appendChild(posterElement);
    block.appendChild(titleElement);
    block.appendChild(contentInfo);
    contentInfo.appendChild(ratingElement)
    //block.appendChild(countryElement);

    // Seasons (if available)
    if (data.seasons && data.seasons.length > 0) {
        const seasonsContainer = document.createElement('div');
        seasonsContainer.classList.add('seasons-container');

        const seasonText = document.createElement('div');
        seasonText.textContent = 'Сезоны: ';

        const maxSeasons = 8;

        // Create buttons for each season using the 'number' variable
        for (let i = 0; i < Math.min(data.seasons.length, maxSeasons); i++) {
            const seasonNumber = data.seasons[i].number; // Get the 'number' variable from the season

            if (seasonNumber !== undefined) {
                const numberSpan = document.createElement('span');
                numberSpan.textContent = seasonNumber;
                numberSpan.classList.add('seasons-square'); // Add the class "square"
                seasonText.appendChild(numberSpan);
            }
        }

        // If there are more than 10 seasons, add an additional square
        if (data.seasons.length > maxSeasons) {
            const remainingSeasons = data.seasons.length - maxSeasons;

            const remainingSpan = document.createElement('span');
            remainingSpan.textContent = `Еще ${remainingSeasons}`;
            remainingSpan.classList.add('seasons-square', 'remaining-square'); // Add additional class for styling
            seasonText.appendChild(remainingSpan);
        }

        seasonsContainer.appendChild(seasonText);

        contentInfo.appendChild(seasonsContainer);
    }

    /*block.appendChild(paidTypesElement); Отображается на кнопке смотреть*/
    block.appendChild(linkElement);

    // Append the block to the container
    blockContainer.appendChild(block);

    return block;
}

// script.js

// Function to filter and display blocks based on search input
function filterBlocks(searchText) {
    const blocks = document.querySelectorAll('.block');

    blocks.forEach(block => {
        const contentTitle = block.querySelector('.content-title').textContent.toLowerCase();
        const contentRating = block.querySelector('.content-rating').textContent.toLowerCase();
        const contentInfo = block.querySelector('.content-info').textContent.toLowerCase();

        // Check if the search text matches any field in the block
        if (
            contentTitle.includes(searchText) ||
            contentRating.includes(searchText) ||
            contentInfo.includes(searchText)
        ) {
            // Display the block
            block.style.display = 'block';
        } else {
            // Hide the block
            block.style.display = 'none';
        }
    });
}

// Listen for input changes in the search bar
const searchInput = document.getElementById('search-bar');

searchInput.addEventListener('input', function () {
    const searchText = this.value.toLowerCase();
    filterBlocks(searchText);
});

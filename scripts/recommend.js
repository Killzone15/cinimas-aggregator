const addMaterialsButton = document.getElementById("add_materials");
const body = document.body;

const contentLinkInput = document.getElementById('content-link');
const contentTitleInput = document.getElementById('content-title');
const contentDescriptionInput = document.getElementById('content-description');
const contentImage = document.getElementById('content-image');
const shareButton = document.getElementById('share-button');


contentLinkInput.addEventListener('input', async () => {
    const userInput = contentLinkInput.value.trim();

    // Regular expression to extract movie ID from various formats
    const regex = /^(?:https:\/\/www\.kinopoisk\.ru\/(?:series|film)\/)?(\d+)\/?$/;
    const match = userInput.match(regex);

    if (match) {
        const contentId = match[1];

        // Replace 'http://localhost:3000' with your actual server URL
        const apiUrl = `/unofficial-kp-api-get-content-info?id=${contentId}`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();

            // Update HTML elements with movie information
            contentImage.src = data.posterUrl;
            contentTitleInput.value = data.nameRu;
            contentDescriptionInput.value = data.description;
        } catch (error) {
            console.error('Error:', error);
            // Handle error as needed
        }
    } else {
        // Clear movie information if the input is invalid
        contentImage.src = '';
        contentTitleInput.value = '';
        contentDescriptionInput.value = '';
    }
});

shareButton.addEventListener('click', function () {
    // Get the values from the elements
    var posterUrl = contentImage.src;
    var contentTitle = contentTitleInput.value;
    var contentDescription = contentDescriptionInput.value;

    let videoContainers = document.querySelectorAll('#new_materials .video-preview-container');
    var videoUrls = [];

    videoContainers.forEach(function (container) {
        var src = container.querySelector('iframe').src;
        var videoId = extractVideoIdFromSrc(src);
        if (videoId) {
            videoUrls.push(videoId);
        }
    });

    // Create a JSON object
    var jsonData = {
        "poster_url": posterUrl,
        "content_title": contentTitle,
        "content_description": contentDescription,
        "materials": {
            "video_urls": videoUrls
        }
    };

    // Create the modal overlay
    const modalOverlay = document.createElement("div");
    modalOverlay.className = "modal-overlay";
    body.appendChild(modalOverlay);

    // Create the modal container
    const modalContainer = document.createElement("div");
    modalContainer.className = "modal-container";
    body.appendChild(modalContainer);

    // Create the modal header
    const modalHeader = document.createElement("div");
    modalHeader.className = "modal-header";
    modalHeader.innerText = "Ссылка";
    modalContainer.appendChild(modalHeader);

    // Create the "Cancel" button
    const cancelButton = document.createElement("button");
    cancelButton.innerText = "Готово";
    cancelButton.addEventListener("click", function () {
        body.removeChild(modalOverlay);
        body.removeChild(modalContainer);
    });
    modalContainer.appendChild(cancelButton);

    // Send the JSON data to the server
    fetch('/create_recommendation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonData),
    })
        .then(response => response.json())
        .then(data => {
            console.log(data);
            const resultString = data.resultString;

            // Display the result in the modal
            const modalResultLink = document.createElement("p");
            modalResultLink.className = "result-link";
            modalResultLink.innerText = resultString;
            modalContainer.appendChild(modalResultLink);
        })
        .catch(error => console.error('Error:', error));
});


addMaterialsButton.addEventListener("click", function () {
    // Create the modal overlay
    const modalOverlay = document.createElement("div");
    modalOverlay.className = "modal-overlay";
    body.appendChild(modalOverlay);

    // Create the modal container
    const modalContainer = document.createElement("div");
    modalContainer.className = "modal-container";
    body.appendChild(modalContainer);

    // Create the modal header
    const modalHeader = document.createElement("div");
    modalHeader.className = "modal-header";
    modalHeader.innerText = "Добавить видео или скриншот";
    modalContainer.appendChild(modalHeader);

    // Create the input field in the modal
    const modalInput = document.createElement("input");
    modalInput.type = "text";
    modalInput.id = `modal_input`;
    modalInput.name = `modal_input`;
    modalInput.className = "input-field";
    modalContainer.appendChild(modalInput);

    // Create a message container for invalid link message
    const invalidLinkMessage = document.createElement("div");
    invalidLinkMessage.className = "invalid-link-message";
    modalContainer.appendChild(invalidLinkMessage);

    // Create the video preview container
    const videoPreviewContainer = document.createElement("div");
    videoPreviewContainer.className = "video-preview-container";
    modalContainer.appendChild(videoPreviewContainer);

    // Create the modal buttons container
    const modalButtonsContainer = document.createElement("div");
    modalButtonsContainer.className = "modal-buttons-container";
    modalContainer.appendChild(modalButtonsContainer);

    // Create the "Cancel" button
    const cancelButton = document.createElement("button");
    cancelButton.innerText = "Cancel";
    cancelButton.addEventListener("click", function () {
        body.removeChild(modalOverlay);
        body.removeChild(modalContainer);
    });
    modalButtonsContainer.appendChild(cancelButton);

    // Create the "Add" button
    const addButton = document.createElement("button");
    addButton.innerText = "Add";
    addButton.disabled = true; // Initially disabled
    addButton.addEventListener("click", function () {
        moveVideoToNewMaterialsContainer();
        body.removeChild(modalOverlay);
        body.removeChild(modalContainer);
    });
    modalButtonsContainer.appendChild(addButton);

    // Listen for input changes to enable/disable the "Add" button
    modalInput.addEventListener("input", function () {
        const videoId = getYouTubeVideoId(modalInput.value.trim());

        // Update the video preview when a valid YouTube link is entered
        if (videoId) {
            videoPreviewContainer.innerHTML = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;

            // Enable the "Add" button only if the video is embedded
            addButton.disabled = !videoPreviewContainer.innerHTML;
        } else {
            // Disable the "Add" button if the input is not a valid YouTube link
            addButton.disabled = true;
        }
    });

    function moveVideoToNewMaterialsContainer() {
        const newMaterialsContainer = document.getElementById('new_materials');

        if (videoPreviewContainer.innerHTML) {
            // Clone the video preview container
            const clonedVideoContainer = videoPreviewContainer.cloneNode(true);

            // Apply specific styling to make the frames more square
            const clonedVideoFrames = clonedVideoContainer.querySelectorAll('iframe');
            clonedVideoFrames.forEach(frame => {
                frame.style.width = "250px"; // Adjust width as needed
                frame.style.height = "250px"; // Adjust height as needed
            });

            // Append the cloned video container to the newMaterialsContainer
            newMaterialsContainer.appendChild(clonedVideoContainer);

            // Clear the content of the original container
            videoPreviewContainer.innerHTML = "";
        }
    }
});


// Function to extract YouTube video ID from a YouTube link
function getYouTubeVideoId(url) {
    const regex = /[?&]v=([^#\&\?]*).*/;
    const match = url.match(regex);
    return match && match[1] ? match[1] : null;
}

function extractVideoIdFromSrc(src) {
    var match = src.match(/\/embed\/([^"?]+)/);
    return match && match[1];
}

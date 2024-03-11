const shareButton = document.getElementById('share-button');
const body = document.body;


document.addEventListener('DOMContentLoaded', function () {
    // Get the content and variant from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const content = urlParams.get('content');
    const variant = urlParams.get('variant');

    if (content && variant) {
        // Make an API call to get recommendation data
        fetch(`/get-recommendation?content=${content}&variant=${variant}`)
            .then(response => response.json())
            .then(data => {
                console.log(data); // Log the data for now, you can update this part based on your requirements
                console.log(data.materials); // Log the data for now, you can update this part based on your requirements
                // Update the UI with the received data (replace console.log with your logic)
                document.getElementById('content-image').src = data.poster_url || '';
                document.getElementById('content-title').innerText = data.content_title || '';
                document.getElementById('content-description').innerText = data.content_description || '';

                const newMaterialsContainer = document.getElementById('new_materials');

                // Iterate over video URLs and create iframe elements
                data.materials.video_urls.forEach(videoUrl => {
                    const videoElement = document.createElement('div');
                    videoElement.className = 'video-preview-container';
                    videoElement.innerHTML = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;

                    // Append the created iframe element to the newMaterialsContainer
                    newMaterialsContainer.appendChild(videoElement);
                });
            })
            .catch(error => console.error('Error:', error));
    } else {
        console.error('Invalid parameters');
    }
});

shareButton.addEventListener('click', function () {
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


    const modalResultLink = document.createElement("p");
    modalResultLink.className = "result-link";
    modalResultLink.innerText = window.location.href;
    modalContainer.appendChild(modalResultLink);
});
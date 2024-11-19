// Initialize and add the map

async function initMap() {
	// The location of UBC (default center)
	const position = { lat: 49.2606, lng: -123.246 };

	// Request needed libraries.
	//@ts-ignore
	const { Map } = await google.maps.importLibrary("maps");
	const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

	// The map, centered at Uluru
	const map = new Map(document.getElementById("map"), {
		zoom: 14, // Adjusted zoom for a closer view
		center: position,
		mapId: "DEMO_MAP_ID",
	});

	const marker = new AdvancedMarkerElement({
		map: map,
		position: { lat: 49.2606, lng: -123.246 },
		title: "UBC",
	});
	// Fetch the campus data from the JSON file
	fetch("data/campus.json")
		.then((response) => response.json())
		.then((data) => {
			// Loop through each room object in the JSON data
			data.forEach((room) => {
				console.log(room);
				const { campus_lat, campus_lon, campus_name, campus_address } = room;

				// Create a marker for each room
				const marker = new AdvancedMarkerElement({
					map: map,
					position: { lat: campus_lat, lng: campus_lon },
					title: campus_name,
				});

				// Optional: Add info window to display campus details
				const infoWindow = new google.maps.InfoWindow({
					content: `
			      <h3>${campus_name}</h3>
			      <p>${campus_address}</p>
			    `,
				});

				// Open the info window when the marker is clicked
				marker.addListener("click", () => {
					infoWindow.open(map, marker);
				});
			});
			console.log(data);
		})
		.catch((error) => console.error("Error loading campus data:", error));
}

// Path to the JSON file (ensure it's publicly accessible from the browser)
const filePath = "./data.json"; // Adjust path based on your project structure

// Fetch the JSON file
fetch(filePath)
	.then((response) => response.json()) // Parse the JSON from the response
	.then((data) => {
		// Handle the data from the JSON file
		console.log(data);
	})
	.catch((error) => {
		console.error("Error loading the JSON file:", error);
	});

initMap();
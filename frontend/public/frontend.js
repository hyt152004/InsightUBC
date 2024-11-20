let buildingRooms = {};

async function initMap() {
	const position = { lat: 49.2606, lng: -123.246 };

	const { Map } = await google.maps.importLibrary("maps");
	const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

	const map = new Map(document.getElementById("map"), {
		zoom: 14,
		center: position,
		mapId: "DEMO_MAP_ID",
	});

	new AdvancedMarkerElement({
		map: map,
		position: { lat: 49.2606, lng: -123.246 },
		title: "UBC",
	});

	try {
		const response = await fetch("data/campus.json");
		const data = await response.json();

		data.forEach((room) => {
			addRoomToHashmap(room);
			const { campus_lat, campus_lon, campus_fullname, campus_shortname, campus_address } = room;

			const marker = new AdvancedMarkerElement({
				map: map,
				position: { lat: campus_lat, lng: campus_lon },
				title: campus_fullname,
			});

			const infoWindow = new google.maps.InfoWindow({
				content: `
			      <h3>${campus_fullname} (${campus_shortname})</h3>
			      <p>${campus_address}</p>
			    `,
			});

			// Open rooms pop up panel
			const roomPopup = document.getElementById("room-popup");
			const roomPopupContent = document.querySelector(".room-popup-content");

			marker.addListener("click", () => {
				// Clear existing content
				roomPopupContent.innerHTML = `
					<button id="exit"><i class="fa fa-close"></i></button>
					<h4>${campus_fullname} (${campus_shortname})</h4>
					<ul id="room-list"></ul>
				`;

				// Populate the list of rooms for this building
				const roomList = document.getElementById("room-list");
				if (buildingRooms[campus_shortname]) {
					buildingRooms[campus_shortname].forEach((room) => {
						const listItem = document.createElement("li");
						listItem.textContent = room.campus_number || "Unknown Room";
						const selectButton = document.createElement("button");
						selectButton.textContent = "Select";
						selectButton.classList.add("select-room-button");
						listItem.prepend(selectButton);
						roomList.appendChild(listItem);
					});
				} else {
					roomList.innerHTML = "<li>No rooms available</li>";
				}

				// Open the popup
				roomPopup.classList.add("open");

				// Add event listener for the exit button
				document.getElementById("exit").addEventListener("click", () => {
					roomPopup.classList.remove("open");
				});
			});

			// Hover over marker for building info
			marker.content.addEventListener("mouseenter", function () {
				infoWindow.open(map, marker);
			});

			marker.content.addEventListener("mouseleave", function () {
				infoWindow.close(map, marker);
			});
		});
	} catch (error) {
		console.error("Error loading campus data:", error);
	}
}

function addRoomToHashmap(room) {
	const { campus_shortname } = room;
	if (!buildingRooms[campus_shortname]) {
		buildingRooms[campus_shortname] = [];
	}
	buildingRooms[campus_shortname].push(room);
}

async function getWalkingDistance(lat1, lng1, lat2, lng2) {
	const apiKey = "AIzaSyB4ofkRUl0baRe9oK0g5LwelMxy2MIpggE";
	const proxyUrl = "https://cors-anywhere.herokuapp.com/"; // or another CORS proxy
	const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${lat1},${lng1}&destinations=${lat2},${lng2}&mode=walking&key=${apiKey}`;

	try {
		const response = await fetch(proxyUrl + url);
		const data = await response.json();

		if (data.rows[0].elements[0].status === "OK") {
			const distance = data.rows[0].elements[0].distance.text;
			const duration = data.rows[0].elements[0].duration.text;
			console.log(`Walking distance: ${distance}`);
			console.log(`Walking duration: ${duration}`);
			return { distance, duration };
		} else {
			console.error("Error getting walking distance:", data.rows[0].elements[0].status);
		}
	} catch (error) {
		console.error("Error making the request:", error);
	}
}

(async () => {
	await initMap();
})();

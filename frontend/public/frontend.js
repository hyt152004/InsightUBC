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

	const selectedRoomList = new Array();

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

						const sidePanel = document.getElementById("side-panel");
						const roomTable = document.getElementById("room-table");
						const tableRow = document.createElement("tr");
						const fullname = document.createElement("td");
						fullname.textContent = room.campus_fullname;
						const shortname = document.createElement("td");
						shortname.textContent = room.campus_shortname;
						const number = document.createElement("td");
						number.textContent = room.campus_number;
						const address = document.createElement("td");
						address.textContent = room.campus_address;
						const seats = document.createElement("td");
						seats.textContent = room.campus_seats;

						selectButton.addEventListener("click", () => {
							selectedRoomList.push(room);
							roomTable.appendChild(tableRow);
							tableRow.appendChild(fullname);
							tableRow.appendChild(shortname);
							tableRow.appendChild(number);
							tableRow.appendChild(address);
							tableRow.appendChild(seats);
							generateListOfWalkingDistance(selectedRoomList);
						});

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
			return { distance, duration };
		} else {
			console.error("Error getting walking distance:", data.rows[0].elements[0].status);
		}
	} catch (error) {
		console.error("Error making the request:", error);
	}
}

function findAllPair(selectedRooms) {
	const pairs = [];

	for (let i = 0; i < selectedRooms.length; i++) {
		for (let j = i + 1; j < selectedRooms.length; j++) {
			pairs.push([selectedRooms[i], selectedRooms[j]]);
		}
	}
	return pairs;
}

async function generateListOfWalkingDistance(selectedRooms) {
	const listOfWalkingDistance = [];

	const pairs = findAllPair(selectedRooms);

	for (let pair of pairs) {
		const roomOneName = pair[0].campus_shortname;
		const roomOneLat = pair[0].campus_lat;
		const roomOneLon = pair[0].campus_lon;

		const roomTwoName = pair[1].campus_shortname;
		const roomTwoLat = pair[1].campus_lat;
		const roomTwoLon = pair[1].campus_lon;

		try {
			const result = await getWalkingDistance(roomOneLat, roomOneLon, roomTwoLat, roomTwoLon);
			listOfWalkingDistance.push(
				roomOneName + " - " + roomTwoName + ": [Distance: " + result.distance + ", Walking Time: " + result.duration
			);
		} catch (err) {
			console.error("Error getting walking distance: " + err);
		}
	}
	return listOfWalkingDistance;
}

(async () => {
	await initMap();
})();

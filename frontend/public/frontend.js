let buildingRooms = {};
const selectedRoomList = new Array();

async function initMap() {
	const position = { lat: 49.2606, lng: -123.246 };

	const { Map } = await google.maps.importLibrary("maps");
	const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

	const map = new Map(document.getElementById("map"), {
		zoom: 14,
		center: position,
		mapId: "DEMO_MAP_ID",
	});

	try {
		const listOfDataset = await fetch("http://localhost:4321/datasets");
		const listOfDatasetJson = await listOfDataset.json();
		if (listOfDatasetJson.result.length === 0) {
			return;
		}
		const id = listOfDatasetJson.result[0].id;
		// const response = await fetch("/data/" + id + ".json");
		// const data = await response.json();
		const query = {
			WHERE: {},
			OPTIONS: {
				COLUMNS: [
					id + "_fullname",
					id + "_shortname",
					id + "_number",
					id + "_name",
					id + "_address",
					id + "_lat",
					id + "_lon",
					id + "_seats",
					id + "_type",
					id + "_furniture",
				],
			},
		};

		const response = await fetch("http://localhost:4321/query", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(query),
		});
		const data = await response.json();

		let isSeatsAscending = true;

		data.result.forEach((room) => {
			addRoomToHashmap(room);
			const {
				campus_lat,
				campus_lon,
				campus_fullname,
				campus_shortname,
				campus_address,
				campus_furniture,
				campus_type,
			} = room;

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

						selectButton.addEventListener("click", async () => {
							if (selectedRoomList.length >= 5) {
								alert("You can only select up to 5 rooms.");
								return;
							}

							if (!selectedRoomList.includes(room)) {
								selectedRoomList.push(room);
								updateRoomTable(room);
								togglePlaceholderMessage();
								const distanceList = await generateListOfWalkingDistance(selectedRoomList);
								await updateWalkingDistances(distanceList);
							}
						});

						listItem.prepend(selectButton);
						roomList.appendChild(listItem);
					});
				} else {
					roomList.innerHTML = "<li>No rooms available</li>";
				}
				roomPopup.classList.add("open");

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

		const roomTable = document.getElementById("room-table");

		document.getElementById("sort-seats").addEventListener("click", () => {
			console.log("Sort button clicked");
			console.log("Toggling sorting state:", isSeatsAscending);
			const sortedSeats = isSeatsAscending
				? ascendingSeatSort([...selectedRoomList])
				: descendingSeatSort([...selectedRoomList]);
			roomTable.innerHTML = "";
			sortedSeats.forEach((room) => {
				updateRoomTable(room);
			});
			isSeatsAscending = !isSeatsAscending;
		});

		document.getElementById("sort-type").addEventListener("click", () => {
			const sortedRoomType = groupByType([...selectedRoomList]);
			roomTable.innerHTML = "";
			sortedRoomType.forEach((room) => {
				updateRoomTable(room);
			});
		});

		document.getElementById("sort-furniture").addEventListener("click", () => {
			const sortedFurniture = groupByFurniture([...selectedRoomList]);
			roomTable.innerHTML = "";
			sortedFurniture.forEach((room) => {
				updateRoomTable(room);
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
		const roomOne = pair[0];
		const roomTwo = pair[1];

		try {
			const result = await getWalkingDistance(
				roomOne.campus_lat,
				roomOne.campus_lon,
				roomTwo.campus_lat,
				roomTwo.campus_lon
			);
			listOfWalkingDistance.push(
				roomOne.campus_shortname +
					"_" +
					roomOne.campus_number +
					" - " +
					roomTwo.campus_shortname +
					"_" +
					roomTwo.campus_number +
					": [Distance: " +
					result.distance +
					", Walking Time: " +
					result.duration +
					"]"
			);
		} catch (err) {
			console.error("Error getting walking distance: " + err);
		}
	}
	return listOfWalkingDistance;
}

async function updateWalkingDistances(distanceList) {
	const distanceContainer = document.getElementById("distance-container");
	distanceContainer.innerHTML = ""; // Clear existing distances

	// Populate the distance container with updated distances
	distanceList.forEach((distance) => {
		const distanceItem = document.createElement("div");
		distanceItem.textContent = distance;
		distanceItem.classList.add("distance-item");
		distanceContainer.appendChild(distanceItem);
	});
}

async function deselectRoom(room) {
	const roomIndex = selectedRoomList.indexOf(room);
	if (roomIndex !== -1) {
		selectedRoomList.splice(roomIndex, 1);
	}

	const rowToRemove = document.querySelector(`[data-room-name="${room.campus_name}"]`);
	if (rowToRemove) {
		rowToRemove.remove();
	}

	togglePlaceholderMessage();
	const distanceList = await generateListOfWalkingDistance(selectedRoomList);
	await updateWalkingDistances(distanceList);
}

function ascendingSeatSort(listOfRooms) {
	return listOfRooms.sort((a, b) => a.campus_seats - b.campus_seats);
}

function descendingSeatSort(listOfRooms) {
	return listOfRooms.sort((a, b) => b.campus_seats - a.campus_seats);
}

function groupByType(listOfRooms) {
	const groups = listOfRooms.reduce((acc, room) => {
		if (!acc[room.campus_type]) {
			acc[room.campus_type] = [];
		}
		acc[room.campus_type].push(room);
		return acc;
	}, {});
	console.log(Object.values(groups).flat());
	return Object.values(groups).flat();
}

function groupByFurniture(listOfRooms) {
	const groups = listOfRooms.reduce((acc, room) => {
		if (!acc[room.campus_furniture]) {
			acc[room.campus_furniture] = [];
		}
		acc[room.campus_furniture].push(room);
		return acc;
	}, {});

	return Object.values(groups).flat();
}

function updateRoomTable(room) {
	const roomTable = document.getElementById("room-table");

	const tableRow = document.createElement("tr");
	tableRow.setAttribute("data-room-name", room.campus_name);

	const building = document.createElement("td");
	building.textContent = room.campus_fullname;

	const roomNumber = document.createElement("td");
	roomNumber.textContent = room.campus_shortname + " " + room.campus_number;

	const address = document.createElement("td");
	address.textContent = room.campus_address;

	const furniture = document.createElement("td");
	furniture.textContent = room.campus_furniture;

	const roomType = document.createElement("td");
	roomType.textContent = room.campus_type;

	const seats = document.createElement("td");
	seats.textContent = room.campus_seats;

	const deselectCell = document.createElement("td");
	const deselectButton = document.createElement("button");
	deselectButton.textContent = "-";
	deselectButton.classList.add("deselect-room-button");
	deselectCell.appendChild(deselectButton);
	deselectButton.addEventListener("click", async () => {
		await deselectRoom(room);
	});

	tableRow.append(building, roomNumber, address, furniture, roomType, seats, deselectCell);
	roomTable.appendChild(tableRow);
}

function togglePlaceholderMessage() {
	const placeholderMessage = document.getElementById("placeholder-message");
	const roomTableContainer = document.getElementById("room-table-container");

	if (selectedRoomList.length === 0) {
		placeholderMessage.style.display = "block";
		roomTableContainer.style.display = "none";
	} else {
		placeholderMessage.style.display = "none";
		roomTableContainer.style.display = "block";
	}
}

(async () => {
	await initMap();
})();

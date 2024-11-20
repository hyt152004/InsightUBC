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
			const { campus_lat, campus_lon, campus_shortname, campus_address } = room;

			const marker = new AdvancedMarkerElement({
				map: map,
				position: { lat: campus_lat, lng: campus_lon },
				title: campus_shortname,
			});

			const infoWindow = new google.maps.InfoWindow({
				content: `
			      <h3>${campus_shortname}</h3>
			      <p>${campus_address}</p>
			    `,
			});

			marker.addListener("click", () => {
				infoWindow.open(map, marker);
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

// function findDistanceBetweenRooms() {
// 	const room1 = buildingRooms["BUCH"][0];
// 	const room2 = buildingRooms["BUCH"][1];
// 	console.log(room1);
// 	console.log(room2);
// }

(async () => {
	await initMap();
	console.log(buildingRooms);
	// findDistanceBetweenRooms();
})();

// async function getWalkingDistance(lat1, lng1, lat2, lng2) {
// 	const apiKey = "AIzaSyB4ofkRUl0baRe9oK0g5LwelMxy2MIpggE";
// 	const proxyUrl = "https://cors-anywhere.herokuapp.com/"; // or another CORS proxy
// 	const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${lat1},${lng1}&destinations=${lat2},${lng2}&mode=walking&key=${apiKey}`;

// 	try {
// 		const response = await fetch(proxyUrl + url);
// 		const data = await response.json();

// 		if (data.rows[0].elements[0].status === "OK") {
// 			const distance = data.rows[0].elements[0].distance.text;
// 			const duration = data.rows[0].elements[0].duration.text;
// 			console.log(`Walking distance: ${distance}`);
// 			console.log(`Walking duration: ${duration}`);
// 			return { distance, duration };
// 		} else {
// 			console.error("Error getting walking distance:", data.rows[0].elements[0].status);
// 		}
// 	} catch (error) {
// 		console.error("Error making the request:", error);
// 	}
// }

// // Example usage
// getWalkingDistance(49.2606, -123.246, 49.262, -123.248);

import JSZip from "jszip";
import { parse } from "parse5";
import * as http from "http";

import { InsightDataset, InsightDatasetKind, InsightError } from "./IInsightFacade";
import SectionsDataset from "../model/SectionsDataset";

export default class RoomProcessor {
	public async addRoomsDataset(id: string, content: string, kind: InsightDatasetKind): Promise<InsightDataset> {
		const jszip = new JSZip();

		return new Promise<InsightDataset>((resolve, reject) => {
			// Load zip content
			jszip
				.loadAsync(content, { base64: true })
				.then(async (zip) => {
					const allRooms = [];
					const indexFile = zip.file("index.htm");

					if (!indexFile) {
						return reject(new InsightError("index.htm file not found in the ZIP"));
					}

					const indexContent = await indexFile.async("text");

					const document = parse(indexContent);

					// from index.htm file we find the table
					const table = this.findTable(document);

					if (!table) {
						return reject(new InsightError("Table not found in index.htm"));
					}

					const tbodyBuildingNodes = this.findAllInstancesWithTagnameUsingChildNodes([table], "tbody");
					const trBuildingNodes = this.findAllInstancesWithTagnameUsingChildNodes(tbodyBuildingNodes, "tr");

					for (const trBuildingNode of trBuildingNodes) {
						const tdBuildingNodesForThisRow = this.findAllInstancesWithTagnameUsingChildNodes([trBuildingNode], "td");

						const fullnameTd = this.findAllInstancesThatIncludeUsingAttrs(
							tdBuildingNodesForThisRow,
							"views-field-title"
						);
						const fullnameA = this.findAllInstancesWithTagnameUsingChildNodes(fullnameTd, "a");
						const fullname = fullnameA[0].childNodes[0].value.trim();

						const shortnameTd = this.findAllInstancesThatIncludeUsingAttrs(
							tdBuildingNodesForThisRow,
							"views-field-field-building-code"
						);
						const shortname = shortnameTd[0].childNodes[0].value.trim();

						const addressTd = this.findAllInstancesThatIncludeUsingAttrs(
							tdBuildingNodesForThisRow,
							"views-field-field-building-address"
						);
						const address = addressTd[0].childNodes[0].value.trim();

						const addressEncoded = encodeURIComponent(address);

						const geolocation = await this.getGeolocation(addressEncoded);
						const lat = geolocation.lat || ""; // Handle default or error cases
						const lon = geolocation.lon || "";

						const href = this.findAllInstancesWithTagnameUsingAttrs(fullnameA, "href")[0];

						const fileInZip = zip.file(href.replace(/^\.\//, ""));

						if (fileInZip) {
							const fileContent = await fileInZip.async("text");

							const buildingDocument = parse(fileContent);

							const roomTable = this.findTable(buildingDocument);

							if (roomTable) {
								const tbodyRoomNodes = this.findAllInstancesWithTagnameUsingChildNodes([roomTable], "tbody");
								const trRoomNodes = this.findAllInstancesWithTagnameUsingChildNodes(tbodyRoomNodes, "tr");
								for (const trRoomNode of trRoomNodes) {
									const tdRoomNodesForThisRow = this.findAllInstancesWithTagnameUsingChildNodes([trRoomNode], "td");
									const numberTd = this.findAllInstancesThatIncludeUsingAttrs(
										tdRoomNodesForThisRow,
										"views-field-field-room-number"
									);
									const numberA = this.findAllInstancesWithTagnameUsingChildNodes(numberTd, "a");
									const number = numberA[0].childNodes[0].value;

									const name = shortname + "_" + number;

									const seatsTd = this.findAllInstancesThatIncludeUsingAttrs(
										tdRoomNodesForThisRow,
										"views-field-field-room-capacity"
									);
									const seats = seatsTd[0].childNodes[0].value.trim();

									const typeTd = this.findAllInstancesThatIncludeUsingAttrs(
										tdRoomNodesForThisRow,
										"views-field-field-room-type"
									);
									const type = typeTd[0].childNodes[0].value.trim();

									const furnitureTd = this.findAllInstancesThatIncludeUsingAttrs(
										tdRoomNodesForThisRow,
										"views-field-field-room-furniture"
									);
									const furniture = furnitureTd[0].childNodes[0].value.trim();

									const newRoom = {
										fullname: fullname,
										shortname: shortname,
										number: number,
										name: name,
										address: address,
										lat: lat,
										lon: lon,
										seats: seats,
										type: type,
										furniture: furniture,
										href: href,
									};
									console.log(newRoom);
									allRooms.push(newRoom);
								}
							}
						} else {
							console.warn(`File not found in ZIP: ${href.value}`);
						}
					}
					// Resolve with placeholder response for now
					resolve({ id, kind, numRows: 0 });
				})
				.catch((err) => {
					return reject(err);
				});
		});
	}

	private async getGeolocation(encodedAddress: string): Promise<any> {
		// Check if encodedAddress is undefined or empty
		if (!encodedAddress) {
			console.error("Encoded address is required.");
			return Promise.reject("Encoded address is required."); // Reject the promise with an error message
		}

		const baseUrl = `http://cs310.students.cs.ubc.ca:11316/api/v1/project_team159/`;
		const url = `${baseUrl}${encodedAddress}`;

		return new Promise((resolve, reject) => {
			http
				.get(url, (res) => {
					const { statusCode } = res;
					const contentType = res.headers["content-type"];
					if (!contentType) {
						console.error("Encoded address is required.");
						return;
					}

					if (statusCode !== 200) {
						reject(new Error("Request Failed.\n" + `Status Code: ${statusCode}`));
						// Consume response data to free up memory
						res.resume();
						return;
					} else if (!/^application\/json/.test(contentType)) {
						reject(new Error("Invalid content-type.\n" + `Expected application/json but received ${contentType}`));
						res.resume();
						return;
					}

					res.setEncoding("utf8");
					let rawData = "";
					res.on("data", (chunk) => {
						rawData += chunk;
					});
					res.on("end", () => {
						try {
							const parsedData = JSON.parse(rawData);
							resolve(parsedData);
						} catch (e) {
							reject(new Error("Error parsing JSON"));
						}
					});
				})
				.on("error", (e) => {
					reject(new Error(`Got error: ${e.message}`));
				});
		});
	}

	private findTable(node: any): any | null {
		if (node.tagName === "table") {
			// console.log(node);

			// TODO: think about case when there are multiple tables
			return node;
		}

		if (node.childNodes && node.childNodes.length > 0) {
			for (const child of node.childNodes) {
				const result = this.findTable(child);
				if (result) {
					return result;
				}
			}
		}
		return null;
	}

	private findAllInstancesWithTagnameUsingChildNodes(nodes: any, tagName: string) {
		let result = [];
		for (const node of nodes) {
			for (const child of node.childNodes) {
				if (child.tagName === tagName) {
					result.push(child);
				}
			}
		}

		return result;
	}

	private findAllInstancesThatIncludeUsingAttrs(nodes: any, includeString: string) {
		let result = [];
		for (const node of nodes) {
			for (const child of node.attrs) {
				if (child.value.includes(includeString)) {
					result.push(node);
				}
			}
		}

		return result;
	}

	private findAllInstancesWithTagnameUsingAttrs(nodes: any, includeString: string) {
		let result = [];
		for (const node of nodes) {
			for (const child of node.attrs) {
				if (child.name === includeString) {
					result.push(child.value);
				}
			}
		}

		return result;
	}

	private async storeToDisk(ds: SectionsDataset): Promise<void> {
		const fs = require("fs-extra");
		try {
			// Ensure the directory exists
			await fs.ensureDir("./data");

			// Write the dataset's sections to a JSON file
			await fs.writeJson("./data/" + ds.id + ".json", ds.sections);
		} catch (err) {
			throw new InsightError(`Error storing json file to disk: ${err}`);
		}
	}
}

import JSZip from "jszip";
import { parse } from "parse5";
import * as http from "http";
import Room from "../model/Room";
import RoomsDataset from "../model/RoomsDataset";
import {
	findAllInstancesThatIncludeUsingAttrs,
	findAllInstancesWithTagnameUsingAttrs,
	findAllInstancesWithTagnameUsingChildNodes,
	isValidBuildingTable,
	isValidIndexTable,
} from "./RoomProcessorHelper";

import { InsightDataset, InsightDatasetKind, InsightError } from "./IInsightFacade";

export default class RoomProcessor {
	public async addRoomsDataset(id: string, content: string, kind: InsightDatasetKind): Promise<InsightDataset> {
		const jszip = new JSZip();

		return new Promise<InsightDataset>((resolve, reject) => {
			// Load zip content
			jszip
				.loadAsync(content, { base64: true })
				.then(async (zip) => {
					const indexFile = zip.file("index.htm");

					if (!indexFile) {
						return reject(new InsightError("index.htm file not found in the ZIP"));
					}
					const indexContent = await indexFile.async("text");

					// from index.htm file we find the table
					const tables = this.findTables(parse(indexContent));

					let validTable = null;
					for (const table of tables) {
						if (isValidIndexTable(table)) {
							validTable = table;
							break;
						}
					}
					// if no validTable are found, return empty list of rooms
					if (!validTable) {
						return reject(new InsightError("Table not found in index.htm"));
					}

					const allRoomsOfAllBuilding = await this.iterateEachBuildingRow(validTable, zip);
					if (allRoomsOfAllBuilding.length === 0) {
						return reject(new InsightError("Not a single valid room found"));
					}
					const roomsData = new RoomsDataset(id, kind, allRoomsOfAllBuilding.length, allRoomsOfAllBuilding);
					await this.storeToDisk(roomsData);
					return resolve(roomsData);
				})
				.catch(() => {
					return reject(new InsightError("Not able to unzip the given Room Zip file"));
				});
		});
	}

	private async iterateEachBuildingRow(table: object, zip: JSZip): Promise<Room[]> {
		let allRoomsOfAllBuilding: Room[] = [];

		const tbodyBuildingNodes = findAllInstancesWithTagnameUsingChildNodes([table], "tbody");
		const trBuildingNodes = findAllInstancesWithTagnameUsingChildNodes(tbodyBuildingNodes, "tr");

		const promises = trBuildingNodes.map(async (trBuildingNode) => {
			const tdBuildingNodesForRow = findAllInstancesWithTagnameUsingChildNodes([trBuildingNode], "td");

			try {
				const [fullname, shortname, address, lat, lon, href] = await this.buildingInfo(tdBuildingNodesForRow);
				const fileInZip = zip.file(href.replace(/^\.\//, ""));

				if (fileInZip) {
					const validTable = await this.getValidTableFromFile(fileInZip);

					// If no valid table is found, return an empty list of rooms
					if (!validTable) {
						return [];
					}

					return this.generateListOfRooms(validTable, fullname, shortname, address, lat, lon, href);
				} else {
					return [];
				}
			} catch {
				return [];
			}
		});

		try {
			const allRoomsArray = await Promise.all(promises);
			allRoomsOfAllBuilding = allRoomsArray.flat();
		} catch (error) {
			throw new InsightError("Error while building final list of Rooms. Error: " + error);
		}

		return allRoomsOfAllBuilding;
	}

	private async getValidTableFromFile(fileInZip: JSZip.JSZipObject): Promise<object | null> {
		try {
			const fileContent = await fileInZip.async("text");
			const buildingDocument = parse(fileContent);
			const tablesInBuildingFile = this.findTables(buildingDocument);

			// Use a loop to find and return the first valid table
			for (const tableFoundInBuildingFile of tablesInBuildingFile) {
				if (isValidBuildingTable(tableFoundInBuildingFile)) {
					return tableFoundInBuildingFile;
				}
			}

			// Return null if no valid table is found
			return null;
		} catch (error) {
			throw new InsightError("Error parsing file content: " + error);
		}
	}

	private async buildingInfo(
		tdBuildingNodesForThisRow: object
	): Promise<[string, string, string, number, number, string]> {
		try {
			const fullnameTd = findAllInstancesThatIncludeUsingAttrs(tdBuildingNodesForThisRow, "views-field-title");
			const fullnameA = findAllInstancesWithTagnameUsingChildNodes(fullnameTd, "a");
			const fullname = fullnameA[0].childNodes[0].value.trim();
			this.validateType(typeof fullname, "string", "fullname is not a string");

			const shortnameTd = findAllInstancesThatIncludeUsingAttrs(
				tdBuildingNodesForThisRow,
				"views-field-field-building-code"
			);
			const shortname = shortnameTd[0].childNodes[0].value.trim();
			this.validateType(typeof shortname, "string", "shortname is not a string");

			const addressTd = findAllInstancesThatIncludeUsingAttrs(
				tdBuildingNodesForThisRow,
				"views-field-field-building-address"
			);
			const address = addressTd[0].childNodes[0].value.trim();
			this.validateType(typeof address, "string", "address is not a string");
			const addressEncoded = encodeURIComponent(address);

			const geolocation = await this.getGeolocation(addressEncoded);
			const lat = geolocation.lat;
			const lon = geolocation.lon;
			this.validateType(typeof lat, "number", "lat is not a number");

			const href = findAllInstancesWithTagnameUsingAttrs(fullnameA, "href")[0];
			this.validateType(typeof href, "string", "href is not a string");
			return [fullname, shortname, address, lat, lon, href];
		} catch {
			throw new InsightError("One of the rooms fields was invalid");
		}
	}

	private generateListOfRooms(
		roomTable: object,
		fname: string,
		sname: string,
		address: string,
		lat: number,
		lon: number,
		href: string
	): Room[] {
		const allRooms = [];

		if (roomTable) {
			const tbodyRoomNodes = findAllInstancesWithTagnameUsingChildNodes([roomTable], "tbody");
			const trRoomNodes = findAllInstancesWithTagnameUsingChildNodes(tbodyRoomNodes, "tr");
			for (const trRoomNode of trRoomNodes) {
				const tdRoomNodesForThisRow = findAllInstancesWithTagnameUsingChildNodes([trRoomNode], "td");

				try {
					const newRoom = this.generateRoom(tdRoomNodesForThisRow, fname, sname, address, lat, lon, href);
					allRooms.push(newRoom);
				} catch {
					// skip this room as it's missing keys
					continue;
				}
			}
		}

		return allRooms;
	}

	private generateRoom(
		tdRoomNodesForThisRow: any,
		fullname: string,
		shortname: string,
		address: string,
		lat: number,
		lon: number,
		href: string
	): Room {
		const [number, seats, type, furniture] = this.extractRoomInfo(tdRoomNodesForThisRow);

		const newRoom = new Room({
			fullname: fullname,
			shortname: shortname,
			number: number,
			name: shortname + "_" + number,
			address: address,
			lat: lat,
			lon: lon,
			seats: seats,
			type: type,
			furniture: furniture,
			href: href,
		});

		return newRoom;
	}

	private extractRoomInfo(tdRoomNodesForThisRow: any): [string, number, string, string] {
		const number = this.extractNumber(tdRoomNodesForThisRow);
		this.validateType(typeof number, "string", "number is not a string");
		const seats = this.extractSeats(tdRoomNodesForThisRow, "views-field-field-room-capacity");
		this.validateType(typeof seats, "number", "seats is not a number");
		const type = this.extractRoomStringInfo(tdRoomNodesForThisRow, "views-field-field-room-type");
		this.validateType(typeof type, "string", "type is not a string");
		const furniture = this.extractRoomStringInfo(tdRoomNodesForThisRow, "views-field-field-room-furniture");
		this.validateType(typeof furniture, "string", "furniture is not a string");

		return [number, seats, type, furniture];
	}

	private validateType(
		valueType: string | number,
		wantedType: string | number,
		errorMessage: string
	): InsightError | void {
		if (valueType !== wantedType) {
			throw new InsightError(errorMessage);
		}
	}

	private extractNumber(tdRoomNodesForThisRow: object): string {
		const numberTd = findAllInstancesThatIncludeUsingAttrs(tdRoomNodesForThisRow, "views-field-field-room-number");
		const numberA = findAllInstancesWithTagnameUsingChildNodes(numberTd, "a");
		return numberA[0].childNodes[0].value;
	}

	private extractSeats(tdRoomNodesForThisRow: object, className: string): number {
		const allTableData = findAllInstancesThatIncludeUsingAttrs(tdRoomNodesForThisRow, className);

		const temp = allTableData[0].childNodes[0].value;
		return Number(temp);
	}

	private extractRoomStringInfo(tdRoomNodesForThisRow: object, className: string): string {
		const allTableData = findAllInstancesThatIncludeUsingAttrs(tdRoomNodesForThisRow, className);
		const temp = allTableData[0].childNodes[0].value.trim();
		return temp;
	}

	private async getGeolocation(encodedAddress: string): Promise<any> {
		const OKstatus = 200;

		// Check if encodedAddress is undefined or empty
		if (!encodedAddress) {
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
						reject(new Error("No content-type received."));
						return;
					}

					if (statusCode !== OKstatus) {
						reject(new Error("Request Failed.\n" + `Status Code: ${statusCode}`));
						res.resume(); // Consume response data to free up memory
						return;
					} else if (!/^application\/json/.test(contentType)) {
						reject(new Error("Invalid content-type.\n" + `Expected application/json but received ${contentType}`));
						res.resume();
						return;
					}

					this.handleResponse(res, resolve, reject);
				})
				.on("error", (e) => {
					reject(new Error(`Got error: ${e.message}`));
				});
		});
	}

	private handleResponse(
		res: http.IncomingMessage,
		resolve: (value: any) => void,
		reject: (reason?: any) => void
	): void {
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
				reject(new Error("Error parsing JSON: " + e));
			}
		});
	}

	private findTables(node: any): any[] {
		let tables: any[] = [];

		if (node.tagName === "table") {
			tables.push(node);
		}

		if (node.childNodes && node.childNodes.length > 0) {
			for (const child of node.childNodes) {
				tables = tables.concat(this.findTables(child));
			}
		}
		return tables;
	}

	private async storeToDisk(ds: RoomsDataset): Promise<void> {
		const fs = require("fs-extra");
		try {
			// Ensure the directory exists
			await fs.ensureDir("./data");

			// Write the dataset's sections to a JSON file
			await fs.writeJson("./data/" + ds.id + ".json", ds.rooms);
		} catch (err) {
			throw new InsightError(`Error storing json file to disk: ${err}`);
		}
	}
}

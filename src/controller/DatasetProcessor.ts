import JSZip from "jszip";
import { parse } from "parse5";
import { InsightDataset, InsightDatasetKind, InsightError } from "./IInsightFacade";
import Section from "../model/Section";
import SectionsDataset from "../model/SectionsDataset";

// import Log from "../../util/Log";

export default class DatasetProcessor {
	public async addSectionsDataset(id: string, content: string, kind: InsightDatasetKind): Promise<InsightDataset> {
		const jszip = new JSZip();

		return new Promise<InsightDataset>((resolve, reject) => {
			// Load zip content
			jszip
				.loadAsync(content, { base64: true })
				.then(async (zip) => this.pushAllSection(zip, reject))
				.then((allSections) => {
					// Wait until all courses are processed
					Promise.all(allSections)
						.then((coursesResult) => this.pushValidSection(coursesResult))
						.then(async (allValidSections) => {
							// check if the valid sections are empty AFTER all courses have been processed
							if (allValidSections.length === 0) {
								return reject(new InsightError("Not a single valid section found"));
							}

							// Return an InsightDataset with all the valid sections added AFTER all courses have been processed
							const allPrefixedSections = [];
							for (const section of allValidSections) {
								allPrefixedSections.push(section.getPrefixedFields(id) as Section);
							}
							const ds = new SectionsDataset(id, kind, allValidSections.length, allPrefixedSections);
							await this.storeToDisk(ds);
							return resolve(ds);
						})
						.catch((err) => {
							return reject(err);
						});
				})
				.catch((err) => {
					return reject(err);
				});
		});
	}

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

					const document = parse(indexContent);

					// from index.htm file we find the table
					const table = this.findTable(document);

					if (!table) {
						return reject(new InsightError("Table not found in index.htm"));
					}

					const tbodyBuildingNodes = this.findAllInstancesWithTagnameUsingChildNodes([table], "tbody");
					const trBuildingNodes = this.findAllInstancesWithTagnameUsingChildNodes(tbodyBuildingNodes, "tr");
					const tdBuildingNodes = this.findAllInstancesWithTagnameUsingChildNodes(trBuildingNodes, "td");
					const tdTitleBuildingNodes = this.findAllInstancesThatIncludeUsingAttrs(tdBuildingNodes, "views-field-title");

					const aBuildingNodes = this.findAllInstancesWithTagnameUsingChildNodes(tdTitleBuildingNodes, "a");
					const attrsBuildingValues = this.findAllInstancesWithTagnameUsingAttrs(aBuildingNodes, "href");
					for (const href of attrsBuildingValues) {
						const fileInZip = zip.file(href.replace(/^\.\//, ""));

						if (fileInZip) {
							const fileContent = await fileInZip.async("text");

							const buildingDocument = parse(fileContent);

							const roomTable = this.findTable(buildingDocument);

							if (roomTable) {
								const tbodyRoomNodes = this.findAllInstancesWithTagnameUsingChildNodes([roomTable], "tbody");
								const trRoomNodes = this.findAllInstancesWithTagnameUsingChildNodes(tbodyRoomNodes, "tr");
								const tdRoomNodes = this.findAllInstancesWithTagnameUsingChildNodes(trRoomNodes, "td");

								for (const tdValue of tdRoomNodes) {
									for (const v of tdValue.childNodes) {
										if (v.value) {
											console.log(v.value);
										}
									}
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
			for (const child of node.href) {
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
			for (const child of node.href) {
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

	private async pushAllSection(zip: JSZip, reject: (error: InsightError) => void): Promise<Promise<string>[]> {
		const allSections: Promise<string>[] = [];
		const coursesFolder = zip.folder(/^courses\/$/);

		// Check if courses folder exists and is at root level
		if (coursesFolder !== null) {
			let numberOfFiles = 0;
			zip.folder("courses")?.forEach(function (_relativePath: string, file: any) {
				numberOfFiles++;
				allSections.push(file.async("string"));
			});

			if (numberOfFiles === 0) {
				reject(new InsightError("courses folder is empty"));
				return Promise.reject();
			}
		} else {
			reject(new InsightError("courses folder not found"));
			return Promise.reject();
		}

		return allSections;
	}

	private pushValidSection(listOfResult: string[]): Section[] {
		const allValidSections: Section[] = [];

		for (const JSONfile of listOfResult) {
			const course = JSON.parse(JSONfile);
			// make sure each result key exists
			if (!Object.prototype.hasOwnProperty.call(course, "result")) {
				continue;
			}
			for (const section of course.result) {
				// If a section has missing field, it is invalid (skip it)
				if (this.missingQueryKey(section)) {
					continue;
				}

				// Set year to 1900 if section == "overall"
				if (Object.prototype.hasOwnProperty.call(section, "Section")) {
					if (section.Section === "overall") {
						section.Year = 1900;
					}
				}

				const validSection = new Section(section);
				allValidSections.push(validSection);
			}
		}

		return allValidSections;
	}

	private missingQueryKey(section: any): boolean {
		if (!Object.prototype.hasOwnProperty.call(section, "Course")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Title")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Professor")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Subject")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Year")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Avg")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Pass")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Fail")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Audit")) {
			return true;
		}
		return false;
	}
}

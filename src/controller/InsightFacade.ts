import sectionProcessor from "./SectionProcessor";
import roomProcessor from "./RoomProcessor";
import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	NotFoundError,
	InsightResult,
} from "./IInsightFacade";
import QueryValidator from "./QueryValidator";
import QueryEngine from "./QueryEngine";
// import Log from "../../util/Log";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	public datasetMap: Map<string, InsightDataset> = new Map<string, InsightDataset>();

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		const fs = require("fs-extra");
		const filePath = "./data/" + id + ".json";
		const sectionsProcessor = new sectionProcessor();
		const roomsProcessor = new roomProcessor();

		try {
			// Check if the ID is valid
			if (this.invalidId(id)) {
				throw new InsightError("Invalid ID");
			}

			// Check if dataset already exists in memory
			if (this.datasetMap.has(id)) {
				throw new InsightError("Duplicated Id (already in memory)");
			}

			// Check if dataset already exists on disk
			const existsOnDisk = await fs.pathExists(filePath);
			if (existsOnDisk) {
				throw new InsightError("Duplicated Id (already on disk)");
			}

			// Process the dataset
			let ds;
			if (kind === InsightDatasetKind.Sections) {
				ds = await sectionsProcessor.addSectionsDataset(id, content, kind);
			} else if (kind === InsightDatasetKind.Rooms) {
				ds = await roomsProcessor.addRoomsDataset(id, content, kind);
			}
			if (!ds) {
				throw new InsightError("Invalid InsightDatasetKind");
			}
			this.datasetMap.set(ds.id, ds);

			// Get all dataset IDs (from both memory and disk)
			const allDatasetIds = await this.getAllDatasetIds();
			return allDatasetIds;
		} catch (err) {
			throw new InsightError(`Error adding dataset: ${err} `);
		}
	}

	public async removeDataset(id: string): Promise<string> {
		const fs = require("fs-extra");
		const filePath = "./data/" + id + ".json";

		return new Promise<string>((resolve, reject) => {
			if (this.invalidId(id)) {
				return reject(new InsightError("Invalid ID"));
			}

			// Check if the dataset exists in memory
			if (!this.datasetMap.has(id)) {
				// If not found in memory, check if the dataset exists on disk
				fs.pathExists(filePath)
					.then((existsOnDisk: any) => {
						if (!existsOnDisk) {
							return reject(new NotFoundError(`Dataset with id '${id}' not found in memory or disk.`));
						}

						// Delete dataset from disk
						return fs.remove(filePath);
					})
					.then(() => {
						return resolve(id);
					})
					.catch(() => {
						return reject(new InsightError("Error removing dataset"));
					});
			} else {
				// If found in memory, remove from memory and disk
				this.datasetMap.delete(id);
				fs.remove(filePath)
					.then(() => {
						return resolve(id);
					})
					.catch(() => {
						return reject(new InsightError("Error removing dataset from disk"));
					});
			}
		});
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		try {
			const queryValidator = new QueryValidator("");

			// Validate the query
			if (!queryValidator.isValidQuery(query)) {
				throw new InsightError("Invalid Query");
			}

			const id = queryValidator.datasetID;

			// Check if the dataset exists in the map, otherwise load it from disk
			if (!this.datasetMap.has(id)) {
				const datasetsFromDisk = await this.readFromDisk();
				datasetsFromDisk.forEach((ds) => {
					if (ds.id === id) {
						this.datasetMap.set(ds.id, ds);
					}
				});

				// If the dataset was still not found after reading from disk, throw an error
				if (!this.datasetMap.has(id)) {
					throw new InsightError(`Dataset with ID ${id} not found.`);
				}
			}

			// Process the query using the query engine
			const queryEngine = new QueryEngine(id);
			const queryResult = queryEngine.processQuery(query, id, this.datasetMap);
			return queryResult;
		} catch (err) {
			return Promise.reject(err);
		}
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		return new Promise<InsightDataset[]>((resolve, reject) => {
			this.readFromDisk()
				.then((datasetsFromDisk) => {
					datasetsFromDisk.forEach((ds) => {
						this.datasetMap.set(ds.id, ds);
					});

					return resolve(Array.from(this.datasetMap.values()));
				})
				.catch(() => {
					return reject("Error listing datasets from disk");
				});
		});
	}

	private invalidId(id: string): boolean {
		if (id === null) {
			return true;
		}
		if (id.trim() === "") {
			return true;
		}
		if (id.includes("_")) {
			return true;
		}

		return false;
	}

	private async readFromDisk(): Promise<InsightDataset[]> {
		await this.checkDirectoryExists("./data/");
		const files = await this.readDirectory("./data/");

		if (files.length === 0) {
			return [];
		}

		const datasets = await this.readJsonFiles(files);
		return datasets;
	}

	private async checkDirectoryExists(dirPath: string): Promise<void> {
		const fs = require("fs-extra");
		const exists = await fs.pathExists(dirPath);
		if (!exists) {
			throw new InsightError(`Directory does not exist.`);
		}
	}

	private async readDirectory(dirPath: string): Promise<string[]> {
		const fs = require("fs-extra");
		return await fs.readdir(dirPath);
	}

	private async readJsonFiles(files: string[]): Promise<InsightDataset[]> {
		const fs = require("fs-extra");
		const result: InsightDataset[] = [];

		const readJsonPromises = files.map(async (file) => {
			const jsonObj = await fs.readJson("./data/" + file);

			const id = file.replace(".json", "");
			if (Object.prototype.hasOwnProperty.call(jsonObj[0], id + "_address")) {
				const dataset: InsightDataset = {
					id: id,
					kind: InsightDatasetKind.Rooms,
					numRows: jsonObj.length,
				};
				result.push(dataset);
			} else {
				const dataset: InsightDataset = {
					id: id,
					kind: InsightDatasetKind.Sections,
					numRows: jsonObj.length,
				};
				result.push(dataset);
			}
		});

		await Promise.all(readJsonPromises);
		return result;
	}

	private async getAllDatasetIds(): Promise<string[]> {
		const fs = require("fs-extra");

		// Get datasets on disk
		const files = await fs.readdir("./data/");
		const allDatasetIds = files.map((file: any) => file.replace(".json", ""));

		return allDatasetIds;
	}
}

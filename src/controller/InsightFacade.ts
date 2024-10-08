import DatasetProcessor from "./DatasetProcessor";
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
		return new Promise<string[]>((resolve, reject) => {
			const dsProcessor = new DatasetProcessor();
			// Check if dataset with same id already exist
			if (this.datasetMap.has(id)) {
				return reject(new InsightError("Duplicated Id"));
			}
			if (this.invalidId(id)) {
				return reject(new InsightError("Invalid ID"));
			}
			dsProcessor
				.addSectionsDataset(id, content, kind)
				.then((ds) => {
					this.datasetMap.set(ds.id, ds);
					const keys = Array.from(this.datasetMap.keys());
					return resolve(keys);
				})
				.catch((err) => {
					return reject(err);
				});
		});
	}

	public async removeDataset(id: string): Promise<string> {
		const fs = require("fs-extra");

		return new Promise<string>((resolve, reject) => {
			if (this.invalidId(id)) {
				reject(new InsightError("Ivalid ID"));
			}
			// Check if dataset with id doesn't exist
			if (!this.datasetMap.has(id)) {
				return reject(new NotFoundError("id not found"));
			}
			this.datasetMap.delete(id);
			fs.remove("./data/" + id + ".json");
			resolve(id);
		});
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		const queryValidator = new QueryValidator("");

		// Validate the query
		if (!queryValidator.isValidQuery(query)) {
			throw new InsightError("Invalid Query");
		}

		const id = queryValidator.datasetID;

		// Check if the dataset exists in the map, otherwise load from disk
		let ds = this.datasetMap.get(id);
		if (!ds) {
			// If the dataset doesn't exist in memory, attempt to load from disk
			try {
				const datasetsFromDisk = await this.readFromDisk();
				datasetsFromDisk.forEach((dataset) => {
					this.datasetMap.set(dataset.id, dataset);
				});
				ds = this.datasetMap.get(id);
				if (!ds) {
					throw new InsightError("Dataset with ID not found after loading from disk.");
				}
			} catch (err) {
				return Promise.reject(err);
			}
		}

		// Process the query using the query engine
		const queryEngine = new QueryEngine(id);
		const queryResult = queryEngine.processQuery(query, id, this.datasetMap);
		return queryResult;
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		return new Promise<InsightDataset[]>((resolve, reject) => {
			this.readFromDisk()
				.then((datasetsFromDisk) => {
					// Clear the current datasetMap and load datasets from the disk
					this.datasetMap.clear();

					datasetsFromDisk.forEach((ds) => {
						this.datasetMap.set(ds.id, ds);
					});

					return resolve(datasetsFromDisk);
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
			const dataset: InsightDataset = {
				id: file.replace(".json", ""),
				kind: InsightDatasetKind.Sections,
				numRows: jsonObj.length,
			};
			result.push(dataset);
		});

		await Promise.all(readJsonPromises);
		return result;
	}
}

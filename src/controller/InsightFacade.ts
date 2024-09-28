import Log from "../../util/Log";
import DatasetProcessor from "./DatasetProcessor";
import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	NotFoundError,
	InsightResult,
} from "./IInsightFacade";

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
				reject(new InsightError("Invalid ID"));
			}
			dsProcessor
				.addSectionsDataset(id, content, kind)
				.then((ds) => {
					this.datasetMap.set(ds.id, ds);
					let keys = Array.from(this.datasetMap.keys());
					return resolve(keys);
				})
				.catch((err) => {
					return reject(new InsightError("Error when adding dataset"));
				});
		});
	}

	public async removeDataset(id: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			if (this.invalidId(id)) {
				reject(new InsightError("Ivalid ID"));
			}
			// Check if dataset with id doesn't exist
			if (!this.datasetMap.has(id)) {
				return reject(new NotFoundError("id not found"));
			}
			this.datasetMap.delete(id);
			resolve(id);
		});
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		// TODO: Remove this once you implement the methods!

		throw new Error(`InsightFacadeImpl::performQuery() is unimplemented! - query=${query};`);
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		return new Promise<InsightDataset[]>((resolve, reject) => {
			try {
				let result: InsightDataset[] = [];
				for (const ds of this.datasetMap.values()) {
					const dataset: InsightDataset = {
						id: ds.id,
						kind: ds.kind,
						numRows: ds.numRows,
					};
					result.push(dataset);
				}
				resolve(result);
			} catch (err) {
				reject(new InsightError("Error while listing datasets"));
			}
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
}

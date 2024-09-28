import Log from "../../util/Log";
import DatasetProcessor from "./DatasetProcessor";
import { IInsightFacade, InsightDataset, InsightDatasetKind, InsightError, InsightResult } from "./IInsightFacade";

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
		// throw new Error(
		// 	`InsightFacadeImpl::addDataset() is unimplemented! - id=${id}; content=${content?.length}; kind=${kind}`
		// );
	}

	public async removeDataset(id: string): Promise<string> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::removeDataset() is unimplemented! - id=${id};`);
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::performQuery() is unimplemented! - query=${query};`);
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::listDatasets is unimplemented!`);
	}
}

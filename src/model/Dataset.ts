import { InsightDataset, InsightDatasetKind } from "../controller/IInsightFacade";

export default class Dataset implements InsightDataset {
	public id: string;
	public kind: InsightDatasetKind;
	public numRows: number;
	public data: any[];

	constructor(id: string, kind: InsightDatasetKind, numRows: number, data: any[]) {
		this.id = id;
		this.kind = kind;
		this.numRows = numRows;
		this.data = data;
	}
}

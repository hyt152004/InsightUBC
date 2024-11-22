import { InsightDataset, InsightDatasetKind } from "../controller/IInsightFacade";
import Dataset from "./Dataset";
import Section from "./Section";

export default class SectionsDataset extends Dataset{
	public id: string;
	public kind: InsightDatasetKind;
	public numRows: number;
	public sections: Section[];

	constructor(id: string, kind: InsightDatasetKind, numRows: number, sections: Section[]) {
		super(id, kind, numRows, sections);
		this.id = id;
		this.kind = kind;
		this.numRows = numRows;
		this.sections = sections;
	}
}

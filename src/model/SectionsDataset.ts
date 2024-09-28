import { InsightDataset, InsightDatasetKind } from "../controller/IInsightFacade";
import Section from "./Section";

export default class SectionsDataset implements InsightDataset {
	public id: string;
	public kind: InsightDatasetKind;
	public numRows: number;
	public sections: Section[];

	constructor(id: string, kind: InsightDatasetKind, numRows: number, sections: Section[]) {
		this.id = id;
		this.kind = kind;
		this.numRows = numRows;
		this.sections = sections;
	}
}

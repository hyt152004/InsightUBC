import { InsightDataset, InsightDatasetKind } from "../controller/IInsightFacade";
import Room from "./Room";

export default class RoomsDataset implements InsightDataset {
	public id: string;
	public kind: InsightDatasetKind;
	public numRows: number;
	public rooms: Room[];

	constructor(id: string, kind: InsightDatasetKind, numRows: number, rooms: Room[]) {
		this.id = id;
		this.kind = kind;
		this.numRows = numRows;
		this.rooms = rooms;
	}
}

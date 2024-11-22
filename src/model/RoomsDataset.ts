import { InsightDataset, InsightDatasetKind } from "../controller/IInsightFacade";
import Dataset from "./Dataset";
import Room from "./Room";

export default class RoomsDataset extends Dataset{
	public id: string;
	public kind: InsightDatasetKind;
	public numRows: number;
	public rooms: Room[];

	constructor(id: string, kind: InsightDatasetKind, numRows: number, rooms: Room[]) {
		super(id, kind, numRows, rooms);
		this.id = id;
		this.kind = kind;
		this.numRows = numRows;
		this.rooms = rooms;
	}
}

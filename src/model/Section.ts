export default class Section {
	private dept: string;
	private avg: number;

	constructor(data: any) {
		this.dept = data.dept;
		this.avg = data.avg;
	}
}

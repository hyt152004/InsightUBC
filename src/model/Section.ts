export default class Section {
	private uuid: string;
	private id: string;
	private title: string;
	private instructor: string;
	private dept: string;
	private year: number;
	private avg: number;
	private pass: number;
	private fail: number;
	private audit: number;

	constructor(data: any) {
		this.uuid = data.id;
		this.id = data.Course;
		this.title = data.Title;
		this.instructor = data.Professor;
		this.dept = data.Subject;
		this.year = data.Year;
		this.avg = data.Avg;
		this.pass = data.Pass;
		this.fail = data.Fail;
		this.audit = data.Audit;
	}
}

import { MultiExpression } from "../MultiExpression";
import { PlacementEnum } from "../AbstractExpression";

/** A bracket line spanning several notes, given by the MusicXML <bracket> element, e.g. used for palm muting ("P.M."). */
export class BracketExpression {
    constructor(numberXml: number = 1) {
        this.numberXml = numberXml;
    }

    public numberXml: number;
    /** MusicXML line-type: "solid" | "dashed" | "dotted" | "wavy". Default is "dashed" for rendering. */
    public lineType: string = "dashed";
    /** MusicXML line-end: "up" | "down" | "both" | "arrow" | "none". */
    public lineEnd: string = "none";
    /** Label drawn at the start of the bracket, e.g. "P.M.". */
    public text: string = "";
    public placement: PlacementEnum = PlacementEnum.NotYetDefined;
    public staffNumber: number = 1;
    public parentStartMultiExpression: MultiExpression;
    public parentEndMultiExpression: MultiExpression;
}

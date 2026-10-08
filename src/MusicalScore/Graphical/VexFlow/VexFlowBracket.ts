import Vex from "vexflow";
import { GraphicalBracket } from "../GraphicalBracket";
import { BracketExpression } from "../../VoiceData/Expressions/ContinuousExpressions/BracketExpression";
import { PlacementEnum } from "../../VoiceData/Expressions/AbstractExpression";
import { BoundingBox } from "../BoundingBox";
import { GraphicalStaffEntry } from "../GraphicalStaffEntry";
import { VexFlowVoiceEntry } from "./VexFlowVoiceEntry";

/**
 * The vexflow adaptation of a graphical bracket, drawn with a Vex.Flow.TextBracket.
 */
export class VexFlowBracket extends GraphicalBracket {
    /** Defines the note where the bracket starts */
    public startNote: Vex.Flow.StemmableNote;
    /** Defines the note where the bracket ends */
    public endNote: Vex.Flow.StemmableNote;
    /** Top or bottom of the staffline */
    public position: Vex.Flow.TextBracket.Positions;

    constructor(bracket: BracketExpression, parent: BoundingBox) {
        super(bracket, parent);
        this.position = bracket.placement === PlacementEnum.Above
            ? Vex.Flow.TextBracket.Positions.TOP
            : Vex.Flow.TextBracket.Positions.BOTTOM;
    }

    public setStartNote(graphicalStaffEntry: GraphicalStaffEntry): boolean {
        const note: Vex.Flow.StemmableNote = VexFlowBracket.findNote(graphicalStaffEntry);
        if (note) {
            this.startNote = note;
        }
        return !!note;
    }

    public setEndNote(graphicalStaffEntry: GraphicalStaffEntry): boolean {
        const note: Vex.Flow.StemmableNote = VexFlowBracket.findNote(graphicalStaffEntry);
        if (note) {
            this.endNote = note;
        }
        return !!note;
    }

    private static findNote(graphicalStaffEntry: GraphicalStaffEntry): Vex.Flow.StemmableNote {
        for (const gve of graphicalStaffEntry?.graphicalVoiceEntries ?? []) {
            const vve: VexFlowVoiceEntry = (gve as VexFlowVoiceEntry);
            if (vve?.vfStaveNote) {
                return vve.vfStaveNote;
            }
        }
        return undefined;
    }

    /** Get the actual vexflow text bracket used for drawing */
    public getTextBracket(): Vex.Flow.TextBracket {
        const textBracket: Vex.Flow.TextBracket = new Vex.Flow.TextBracket({
            position: this.position,
            start: this.startNote,
            stop: this.endNote,
            text: this.isContinuation ? "" : this.bracket.text,
        });
        const renderOptions: any = (textBracket as any).render_options;
        // solid, dotted etc. are rendered as dashed or solid
        textBracket.setDashed(this.bracket.lineType !== "solid");
        // "up"/"down"/"both" draw the end hook, "none" doesn't. no hook if the bracket continues on the next staffline.
        renderOptions.show_bracket = !this.endsOnDifferentStaffLine && this.bracket.lineEnd !== "none";
        return textBracket;
    }
}

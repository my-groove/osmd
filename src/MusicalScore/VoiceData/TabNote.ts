import { Note } from "./Note";
import { Fraction } from "../../Common/DataObjects/Fraction";
import { VoiceEntry } from "./VoiceEntry";
import { SourceStaffEntry } from "./SourceStaffEntry";
import { Pitch } from "../../Common/DataObjects/Pitch";
import { SourceMeasure } from "./SourceMeasure";

export interface TabBend {
    bendalter: number;
    direction: string;
    /** For a bend synthesized from a slur chain (see SlurReader.addSlur()): the note this bend step visually
     *  reaches (the peak note for an "up" step, the landing note for a "down"/release step), so the curve can
     *  be sized to actually end there once that note's final x position is known, instead of guessing a fixed
     *  width (see VexFlowConverter.CreateTabNote(), VexFlowPatch/src/bend.js draw()). */
    visualTargetNote?: TabNote;
}

export class TabNote extends Note {
    constructor(voiceEntry: VoiceEntry, parentStaffEntry: SourceStaffEntry, length: Fraction, pitch: Pitch, sourceMeasure: SourceMeasure,
                stringNumber: number, fretNumber: number, bendArray: TabBend[],
                vibratoStroke: boolean) {
        super(voiceEntry, parentStaffEntry, length, pitch, sourceMeasure);
        this.stringNumberTab = stringNumber;
        this.fretNumber = fretNumber;
        this.bendArray = bendArray;
        this.vibratoStroke = vibratoStroke;
    }

    private stringNumberTab: number; // there can also be string numbers for e.g. violin in treble clef.
    private fretNumber: number;
    private bendArray: TabBend[];
    private vibratoStroke: boolean;

    /** Returns the string number the note should be played on. Note there can also be violin string numbers in treble clef. */
    public get StringNumberTab(): number {
        return this.stringNumberTab;
    }

    public get FretNumber(): number {
        return this.fretNumber;
    }

    public get BendArray(): TabBend[] {
        return this.bendArray;
    }

    public get VibratoStroke(): boolean {
        return this.vibratoStroke;
    }

    public hasTabEffects(): boolean {
        return this.bendArray?.length > 0 || this.vibratoStroke;
    }
}

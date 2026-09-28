import Vex from "vexflow";
import VF = Vex.Flow;
import { Staff } from "../../VoiceData/Staff";
import { SourceMeasure } from "../../VoiceData/SourceMeasure";
import { VexFlowMeasure } from "./VexFlowMeasure";
import { VexFlowStaffEntry } from "./VexFlowStaffEntry";
import { VexFlowConverter } from "./VexFlowConverter";
import { StaffLine } from "../StaffLine";
import { GraphicalVoiceEntry } from "../GraphicalVoiceEntry";
import { VexFlowVoiceEntry } from "./VexFlowVoiceEntry";
import { Arpeggio } from "../../VoiceData/Arpeggio";
import { Voice } from "../../VoiceData/Voice";
import log from "loglevel";
import { ClefEnum, ClefInstruction } from "../../VoiceData/Instructions/ClefInstruction";

export class VexFlowTabMeasure extends VexFlowMeasure {
    private multiRestElement: any; // VexFlow: Element

    constructor(staff: Staff, sourceMeasure: SourceMeasure = undefined, staffLine: StaffLine = undefined) {
        super(staff, sourceMeasure, staffLine);
        this.isTabMeasure = true;
    }

    /**
     * Reset all the geometric values and parameters of this measure and put it in an initialized state.
     * This is needed to evaluate a measure a second time by system builder.
     */
    public resetLayout(): void {
        // Take into account some space for the begin and end lines of the stave
        // Will be changed when repetitions will be implemented
        //this.beginInstructionsWidth = 20 / UnitInPixels;
        //this.endInstructionsWidth = 20 / UnitInPixels;
        const stafflineCount: number = this.ParentStaff.StafflineCount ?? 6; // if undefined, 6 by default (same as Vexflow default)
        this.stave = new VF.TabStave(0, 0, 0, {
            space_above_staff_ln: 0,
            space_below_staff_ln: 0,
            num_lines: stafflineCount
        });
        // also see VexFlowMusicSheetDrawer.drawSheet() for some other vexflow default value settings (like default font scale)
        this.updateInstructionWidth();
    }

    public graphicalMeasureCreatedCalculations(): void {
        let graceSlur: boolean;
        let graceGVoiceEntriesBefore: GraphicalVoiceEntry[] = [];
        for (let idx: number = 0, len: number = this.staffEntries.length; idx < len; ++idx) {
            const graphicalStaffEntry: VexFlowStaffEntry = (this.staffEntries[idx] as VexFlowStaffEntry);
            graceSlur = false;
            graceGVoiceEntriesBefore = [];

            // create vex flow Notes:
            for (const gve of graphicalStaffEntry.graphicalVoiceEntries) {
                if (gve.parentVoiceEntry.IsGrace) {
                    // save grace notes for the next non-grace note, same as in VexFlowMeasure.graphicalMeasureCreatedCalculations()
                    graceGVoiceEntriesBefore.push(gve);
                    if (!graceSlur) {
                        graceSlur = gve.parentVoiceEntry.GraceSlur;
                    }
                    continue;
                }
                if (gve.notes[0].sourceNote.isRest()) {
                    // Use standard rest rendering for tab staves
                    if (!this.rules.TabRestsRendered) {
                        // keep the rest's duration/spacing intact, just make it invisible.
                        // setStyle() alone isn't enough, because VexFlowVoiceEntry.color() re-colors noteheads afterwards
                        // (during MusicSheetCalculator.calculateMusicSystems()) unless PrintObject is false.
                        gve.notes[0].sourceNote.PrintObject = false;
                    }
                    (gve as VexFlowVoiceEntry).vfStaveNote = VexFlowConverter.StaveNote(gve);
                    // const ghostNotes: VF.GhostNote[] = VexFlowConverter.GhostNotes(gve.notes[0].sourceNote.Length);
                    // (gve as VexFlowVoiceEntry).vfGhostNotes = ghostNotes; // we actually need multiple ghost notes sometimes, see #1062 Sep. 23 2021 comment
                    // (gve as VexFlowVoiceEntry).vfStaveNote = ghostNotes[0];
                } else {
                    (gve as VexFlowVoiceEntry).vfStaveNote = VexFlowConverter.CreateTabNote(gve);
                }

                if (graceGVoiceEntriesBefore.length > 0) {
                    // add grace notes that came before this main note to a GraceNoteGroup in Vexflow, attached to the main note
                    const graceNotes: VF.TabNote[] = [];
                    for (const gveGrace of graceGVoiceEntriesBefore) {
                        const vfTabNote: VF.TabNote = VexFlowConverter.CreateTabNote(gveGrace);
                        (gveGrace as VexFlowVoiceEntry).vfStaveNote = vfTabNote;
                        graceNotes.push(vfTabNote);
                    }
                    // GraceNoteGroup is typed for VF.GraceNote[] (which extends StaveNote in the type definitions),
                    //   but at runtime it also supports VF.TabNote (see gracenotegroup.js's is_stavenote checks). Cast around the incomplete typing.
                    const graceNoteGroup: VF.GraceNoteGroup = new VF.GraceNoteGroup(graceNotes as unknown as VF.GraceNote[], graceSlur);
                    let xMargin: number = this.rules.GraceNoteGroupXMargin;
                    if (graceNotes.length > 1) {
                        xMargin /= 3; // prevent overlap. multiple grace notes end up closer to the main note.
                    }
                    (graceNoteGroup as any).spacing = xMargin * 10;
                    // TabNote.addModifier() uses the base Note signature (modifier, index), unlike StaveNote's overridden (index, modifier).
                    ((gve as VexFlowVoiceEntry).vfStaveNote as VF.TabNote).addModifier(graceNoteGroup, 0);
                    graceGVoiceEntriesBefore = [];
                }
            }
        }
        // remaining grace notes at end of measure, turned into stand-alone grace notes:
        if (graceGVoiceEntriesBefore.length > 0) {
            for (const graceGve of graceGVoiceEntriesBefore) {
                (graceGve as VexFlowVoiceEntry).vfStaveNote = VexFlowConverter.CreateTabNote(graceGve);
                graceGve.parentVoiceEntry.GraceAfterMainNote = true;
            }
        }

        this.finalizeTuplets(); // this is necessary for x-alignment even when we don't want to show tuplet brackets or numbers

        const voices: Voice[] = this.getVoicesWithinMeasure();

        for (const voice of voices) {
            if (!voice) {
                continue;
            }

            // add a vexFlow voice for this voice:
            this.vfVoices[voice.VoiceId] = new VF.Voice({
                        beat_value: this.parentSourceMeasure.Duration.Denominator,
                        num_beats: this.parentSourceMeasure.Duration.Numerator,
                        resolution: VF.RESOLUTION,
                    }).setMode(VF.Voice.Mode.SOFT);

            const restFilledEntries: GraphicalVoiceEntry[] =  this.getRestFilledVexFlowStaveNotesPerVoice(voice);
            // create vex flow voices and add tickables to it:
            for (const voiceEntry of restFilledEntries) {
                if (voiceEntry.parentVoiceEntry) {
                    if (voiceEntry.parentVoiceEntry.IsGrace && !voiceEntry.parentVoiceEntry.GraceAfterMainNote) {
                        continue;
                    }
                }

                const vexFlowVoiceEntry: VexFlowVoiceEntry = voiceEntry as VexFlowVoiceEntry;
                if (voiceEntry.notes.length === 0 || !voiceEntry.notes[0] || !voiceEntry.notes[0].sourceNote.PrintObject) {
                    // GhostNote, don't add modifiers like in-measure clefs
                    if (vexFlowVoiceEntry.vfGhostNotes) {
                        for (const ghostNote of vexFlowVoiceEntry.vfGhostNotes) {
                            this.vfVoices[voice.VoiceId].addTickable(ghostNote);
                        }
                    } else {
                        this.vfVoices[voice.VoiceId].addTickable(vexFlowVoiceEntry.vfStaveNote);
                    }
                    continue;
                }

                // don't add non-tab fingerings for tab measures (doesn't work yet for tabnotes in vexflow, see VexFlowMeasure.createFingerings())
                // if (voiceEntry.parentVoiceEntry && this.rules.RenderFingerings) {
                //     this.createFingerings(voiceEntry);
                // }

                // add Arpeggio
                if (voiceEntry.parentVoiceEntry && voiceEntry.parentVoiceEntry.Arpeggio) {
                    const arpeggio: Arpeggio = voiceEntry.parentVoiceEntry.Arpeggio;
                    // TODO right now our arpeggio object has all arpeggio notes from arpeggios across all voices.
                    // see VoiceGenerator. Doesn't matter for Vexflow for now though
                    if (voiceEntry.notes && voiceEntry.notes.length > 1) {
                        const type: VF.Stroke.Type = VexFlowConverter.StrokeTypeFromArpeggioType(arpeggio.type);
                        const stroke: VF.Stroke = new VF.Stroke(type, {
                            all_voices: this.rules.ArpeggiosGoAcrossVoices
                            // default: false. This causes arpeggios to always go across all voices, which is often unwanted.
                            // also, this can cause infinite height of stroke, see #546
                        });
                        //if (arpeggio.notes.length === vexFlowVoiceEntry.notes.length) { // different workaround for endless y bug
                        if (this.rules.RenderArpeggios) {
                            vexFlowVoiceEntry.vfStaveNote.addStroke(0, stroke);
                        }
                    } else {
                        log.debug(`[OSMD] arpeggio in measure ${this.MeasureNumber} could not be drawn.
                        voice entry had less than two notes, arpeggio is likely between voice entries, not currently supported in Vexflow.`);
                        // TODO: create new arpeggio with all the arpeggio's notes (arpeggio.notes), perhaps with GhostNotes in a new vfStaveNote. not easy.
                    }
                }

                if (vexFlowVoiceEntry.vfGhostNotes) {
                    for (const ghostNote of vexFlowVoiceEntry.vfGhostNotes) {
                        this.vfVoices[voice.VoiceId].addTickable(ghostNote);
                    }
                } else {
                    this.vfVoices[voice.VoiceId].addTickable(vexFlowVoiceEntry.vfStaveNote);
                }
            }
        }
        // this.createArticulations();
        // this.createOrnaments();
    }

     public addClefAtBegin(clef: ClefInstruction): void {
        if (clef.ClefType === ClefEnum.TAB) {
            super.addClefAtBegin(clef);
        }
        // else return; // we don't need clefs in tabs.
     }

     public draw(ctx: Vex.IRenderContext): void {
        super.draw(ctx);

        // draw multi-measure rest: unlike a classical measure, this is not a VexFlowMultiRestMeasure class,
        //   so we need to add the multiple measure rest element drawing here.
        const sourceMeasure: SourceMeasure = this.parentSourceMeasure;
        if (sourceMeasure.multipleRestMeasures && this.rules.RenderMultipleRestMeasures) {
            this.multiRestElement = new VF.MultiMeasureRest(sourceMeasure.multipleRestMeasures, {
                        // number_line: 3
            });
            this.multiRestElement.setStave(this.stave);
            this.multiRestElement.setContext(ctx);
            this.multiRestElement.draw();
        }
     }
}

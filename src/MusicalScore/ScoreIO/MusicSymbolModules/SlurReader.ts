import { MusicSheet } from "../../MusicSheet";
import { IXmlElement, IXmlAttribute } from "../../../Common/FileIO/Xml";
import { Slur } from "../../VoiceData/Expressions/ContinuousExpressions/Slur";
import { Note } from "../../VoiceData/Note";
import { TabNote } from "../../VoiceData/TabNote";
import log from "loglevel";
import { ITextTranslation } from "../../Interfaces/ITextTranslation";
import { PlacementEnum } from "../../VoiceData/Expressions";
import { Glissando } from "../../VoiceData/Glissando";

export class SlurReader {
    private musicSheet: MusicSheet;
    private openSlurDict: { [_: number]: Slur } = {};
    // maps a synthesized up-bend's target note (the hidden peak note) to the note the bend started from,
    //   so a subsequent release slur starting at that peak (see addSlur()) can attach its bend to the same
    //   note as the up-bend instead of to the peak note, letting VexFlowConverter draw one connected curve.
    private tabBendUpSourceNotes: Map<TabNote, TabNote> = new Map<TabNote, TabNote>();
    constructor(musicSheet: MusicSheet) {
        this.musicSheet = musicSheet;
    }
    public addSlur(slurNodes: IXmlElement[], currentNote: Note): void {
        try {
            if (slurNodes) {
                for (const slurNode of slurNodes) {
                    if (slurNode.attributes().length > 0) {
                        const type: string = slurNode.attribute("type").value;
                        let slurNumber: number = 1;
                        try {
                            const slurNumberAttribute: IXmlAttribute = slurNode.attribute("number");
                            if (slurNumberAttribute) {
                                slurNumber = parseInt(slurNode.attribute("number").value, 10);
                            }
                        } catch (ex) {
                            log.debug("VoiceGenerator.addSlur number: ", ex);
                        }

                        let slurPlacementXml: PlacementEnum = PlacementEnum.NotYetDefined;
                        const placementAttr: Attr = slurNode.attribute("placement");
                        if (placementAttr && placementAttr.value) {
                            if (placementAttr.value === "above") {
                                slurPlacementXml = PlacementEnum.Above;
                            } else if (placementAttr.value === "below") {
                                slurPlacementXml = PlacementEnum.Below;
                            }
                        }
                        const orientationAttr: Attr = slurNode.attribute("orientation"); // alternative for placement, used by Sibelius
                        if (orientationAttr && orientationAttr.value) {
                            if (orientationAttr.value === "over") {
                                slurPlacementXml = PlacementEnum.Above;
                            } else if (orientationAttr.value === "under") {
                                slurPlacementXml = PlacementEnum.Below;
                            }
                        }
                        if (type === "start") {
                            let slur: Slur = this.openSlurDict[slurNumber];
                            if (!slur) {
                                slur = new Slur();
                                this.openSlurDict[slurNumber] = slur;
                            }
                            slur.StartNote = currentNote;
                            slur.PlacementXml = slurPlacementXml;
                        } else if (type === "stop") {
                            const slur: Slur = this.openSlurDict[slurNumber];
                            if (slur) {
                                const nodeName: string = slurNode.name;
                                if (nodeName === "slide" || nodeName === "glissando") {
                                    // TODO for now, we abuse the SlurReader to also process slides and glissandi, to avoid a lot of duplicate code.
                                    //   though we might want to separate the code a bit, at least use its own openGlissDict instead of openSlurDict.
                                    //   also see variable glissElements later on
                                    const startNote: Note = slur.StartNote;
                                    const newGlissando: Glissando = new Glissando(startNote);
                                    newGlissando.AddNote(currentNote);
                                    newGlissando.EndNote = currentNote;
                                    currentNote.NoteGlissando = newGlissando;
                                    // TODO use its own dict, openSlideDict? Can this cause problems if slur and slide have the same number?
                                    delete this.openSlurDict[slurNumber];
                                } else {
                                    slur.EndNote = currentNote;
                                    const slurStartNote: Note = slur.StartNote;
                                    if (this.isTabBendExportedAsSlur(slurStartNote, currentNote)) {
                                        // some exporters (e.g. Sibelius via Dolet) can't export guitar bends as a
                                        //   proper MusicXML <bend> element and export them as a plain <slur> instead.
                                        //   treat this as a bend rather than rendering a plain slur curve on the tab staff.
                                        const startTabNote: TabNote = slurStartNote as TabNote;
                                        const endTabNote: TabNote = currentNote as TabNote;
                                        const bendsUp: boolean = endTabNote.FretNumber > startTabNote.FretNumber;
                                        // if this is a release continuing from a synthesized up-bend (startTabNote is that
                                        //   bend's hidden peak note), attach it to the note the up-bend itself started from,
                                        //   so both bend steps end up on one note (see VexFlowConverter.CreateTabNote()),
                                        //   which draws them as a single connected curve instead of two disjointed ones.
                                        const bendUpSourceNote: TabNote = this.tabBendUpSourceNotes.get(startTabNote);
                                        const isRedirectedRelease: boolean = !bendsUp && !!bendUpSourceNote;
                                        const bendTargetNote: TabNote = isRedirectedRelease ? bendUpSourceNote : startTabNote;
                                        bendTargetNote.BendArray.push({
                                            // semitone delta (1 fret = 1 semitone), consistent with the semitone value
                                            //   a real MusicXML <bend-alter> element would carry (see VoiceGenerator.addSingleNote()).
                                            bendalter: Math.abs(endTabNote.FretNumber - startTabNote.FretNumber),
                                            direction: bendsUp ? "up" : "down",
                                            // endTabNote is where this step visually reaches whether or not it's
                                            //   redirected: the (hidden) peak note for an up-bend, or the landing
                                            //   note for a release (e.g. a grace note bending down into its main
                                            //   note lands on endTabNote just as much as a redirected one does).
                                            visualTargetNote: endTabNote,
                                        });
                                        if (bendsUp) {
                                            // standard tab notation shows only the starting fret with a bend arrow, not a second
                                            //   fret number for the target pitch: hide the target note's tab glyph, keeping its
                                            //   duration (see the PrintObject check in VexFlowTabMeasure.graphicalMeasureCreatedCalculations()).
                                            //   a release (bend down) is the opposite: the landing fret is shown, not hidden.
                                            endTabNote.PrintObject = false;
                                            this.tabBendUpSourceNotes.set(endTabNote, startTabNote);
                                        } else if (bendUpSourceNote) {
                                            this.tabBendUpSourceNotes.delete(startTabNote);
                                        }
                                        if (startTabNote.ParentVoiceEntry?.IsGrace) {
                                            // suppress the decorative grace-to-main-note tie (InstrumentReader.ts sets this
                                            //   from the raw <slur> presence, independently of this reinterpretation):
                                            //   the bend arrow already visually conveys the connection.
                                            startTabNote.ParentVoiceEntry.GraceSlur = false;
                                        }
                                    } else if (
                                        !slurStartNote.ParentVoiceEntry?.IsGrace &&
                                        !currentNote.ParentVoiceEntry?.IsGrace &&
                                        !currentNote.isDuplicateSlur(slur)
                                    ) {
                                        // check if not already a slur with same notes has been given:
                                        // if not, link slur to notes. (grace notes are excluded: the graphical slur
                                        //   pipeline doesn't support slurs starting/ending on a grace note, see VoiceGenerator.read())
                                        currentNote.NoteSlurs.push(slur);
                                        slurStartNote.NoteSlurs.push(slur);
                                    }
                                    delete this.openSlurDict[slurNumber];
                                }
                            }
                        }
                    }
                }
            }
        } catch (err) {
            const errorMsg: string = ITextTranslation.translateText("ReaderErrorMessages/SlurError", "Error while reading slur.");
            this.musicSheet.SheetErrors.pushMeasureError(errorMsg);
        }
    }

    /** Detects the Sibelius/Dolet "guitar bend exported as slur" pattern: a slur linking two tab notes
     *  on the same string, with a fret difference small enough to plausibly be a bend (not a slide). */
    private isTabBendExportedAsSlur(startNote: Note, endNote: Note): boolean {
        if (!this.musicSheet.Rules.TabSlursAsBends || !startNote || !endNote) {
            return false;
        }
        if (!(startNote instanceof TabNote) || !(endNote instanceof TabNote)) {
            return false;
        }
        const startTabNote: TabNote = startNote;
        const endTabNote: TabNote = endNote;
        if (startTabNote.StringNumberTab !== endTabNote.StringNumberTab) {
            return false;
        }
        // up to a 2-whole-step bend (4 frets/semitones), the largest commonly used in guitar tab notation.
        const fretDifference: number = Math.abs(startTabNote.FretNumber - endTabNote.FretNumber);
        return fretDifference > 0 && fretDifference <= 4;
    }
}

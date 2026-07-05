"use client";

import type { ChangeEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { Image as ImageIcon } from "lucide-react";
import type { DbRow, SafeZonePreset, TemplateElement, TemplateElementType } from "../types";
import { SAFE_ZONE_PRESETS, TEMPLATE_FONT_FAMILIES, TEMPLATE_FONT_WEIGHTS } from "../types";
import { formatTemplateSummary, readableTemplateTextColor } from "../utils";
import { EmptyState, Panel } from "./CoreUI";

type CropInsets = { top: number; bottom: number; left: number; right: number };

export type TemplatesTabProps = {
  templateName: string;
  onTemplateNameChange: (value: string) => void;
  templateAccent: string;
  onTemplateAccentChange: (value: string) => void;
  templateStyle: string;
  onTemplateStyleChange: (value: string) => void;
  creativeMediaTypes: string[];
  onCreativeMediaTypeSelection: (value: string) => void;
  creativeAspectRatio: string;
  onUpdateTemplateFormat: (ratio: string) => void;
  mediaFormatLabel: string;
  onAddTemplateElement: (type: TemplateElementType) => void;
  templateCanvasRef: RefObject<HTMLDivElement | null>;
  onMoveTemplateDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onEndTemplateDrag: () => void;
  templatePreviewRatioClass: string;
  templateSafeZonesEnabled: boolean;
  onToggleTemplateSafeZones: (enabled: boolean) => void;
  activePlacementCrop: CropInsets;
  activeSafeArea: CropInsets;
  activeSafeZoneLabel: string;
  templateGuides: { vertical: boolean; horizontal: boolean };
  templateElements: TemplateElement[];
  selectedTemplateElementId: string;
  onSelectTemplateElement: (id: string) => void;
  selectedProductMediaUrl: string;
  onStartTemplateDrag: (event: ReactPointerEvent<HTMLDivElement>, element: TemplateElement) => void;
  selectedTemplateElement: TemplateElement | null;
  onRemoveTemplateElement: (id: string) => void;
  onUpdateTemplateElement: (id: string, patch: Partial<TemplateElement>) => void;
  onUploadTemplateLogo: (event: ChangeEvent<HTMLInputElement>, id: string) => void;
  selectedElementMediaUrl: string;
  templateSafeZoneId: string;
  onUpdateTemplateSafeZone: (zone: SafeZonePreset) => void;
  onSaveTemplate: () => void;
  templateBusy: boolean;
  savedTemplates: DbRow[];
  selectedTemplateIds: string[];
  onToggleTemplateSelection: (templateId: string) => void;
};

export default function TemplatesTab({
  templateName,
  onTemplateNameChange,
  templateAccent,
  onTemplateAccentChange,
  templateStyle,
  onTemplateStyleChange,
  creativeMediaTypes,
  onCreativeMediaTypeSelection,
  creativeAspectRatio,
  onUpdateTemplateFormat,
  mediaFormatLabel,
  onAddTemplateElement,
  templateCanvasRef,
  onMoveTemplateDrag,
  onEndTemplateDrag,
  templatePreviewRatioClass,
  templateSafeZonesEnabled,
  onToggleTemplateSafeZones,
  activePlacementCrop,
  activeSafeArea,
  activeSafeZoneLabel,
  templateGuides,
  templateElements,
  selectedTemplateElementId,
  onSelectTemplateElement,
  selectedProductMediaUrl,
  onStartTemplateDrag,
  selectedTemplateElement,
  onRemoveTemplateElement,
  onUpdateTemplateElement,
  onUploadTemplateLogo,
  selectedElementMediaUrl,
  templateSafeZoneId,
  onUpdateTemplateSafeZone,
  onSaveTemplate,
  templateBusy,
  savedTemplates,
  selectedTemplateIds,
  onToggleTemplateSelection,
}: TemplatesTabProps) {
  return (
    <Panel title="Ad templates">
<div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
                    <div className="space-y-4">
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div>
                          <h3 className="font-bold text-gray-950">Template builder</h3>
                          <p className="mt-1 text-sm text-gray-600">Drag every text, logo, media and CTA block directly on the canvas. Text, media and CTA are variable slots for ad creation. Logos stay fixed.</p>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-gray-950">Template name</span>
                            <input value={templateName} onChange={event => onTemplateNameChange(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-gray-950">Accent color</span>
                            <input type="color" value={templateAccent} onChange={event => onTemplateAccentChange(event.target.value)} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2 py-1" />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-gray-950">Style direction</span>
                            <select value={templateStyle} onChange={event => onTemplateStyleChange(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                              <option>Premium clean</option>
                              <option>Bold product hero</option>
                              <option>Editorial fashion</option>
                              <option>UGC proof card</option>
                              <option>Offer focused</option>
                            </select>
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-gray-950">Ad type</span>
                            <select value={creativeMediaTypes.length > 1 ? 'photo_video' : creativeMediaTypes[0]} onChange={event => onCreativeMediaTypeSelection(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900">
                              <option value="photo_video">Photo + Video</option>
                              <option value="photo">Photo only</option>
                              <option value="video">Video only</option>
                            </select>
                          </label>
                        </div>

                        <div className="mt-4">
                          <div className="text-sm font-semibold text-gray-950">Ratio</div>
                          <div className="mt-2 grid grid-cols-4 gap-2 rounded-lg bg-gray-50 p-1">
                            {['4:5', '9:16', '1:1', '16:9'].map(ratio => (
                              <button key={ratio} type="button" onClick={() => onUpdateTemplateFormat(ratio)} className={`rounded-md px-2 py-2 text-sm font-semibold ${creativeAspectRatio === ratio ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700 hover:bg-white'}`}>{ratio}</button>
                            ))}
                          </div>
                        </div>


                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="button" onClick={() => onAddTemplateElement('text')} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50">Add text</button>
                          <button type="button" onClick={() => onAddTemplateElement('logo')} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50">Add logo</button>
                          <button type="button" onClick={() => onAddTemplateElement('media')} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50">Add media slot</button>
                          <button type="button" onClick={() => onAddTemplateElement('cta')} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50">Add CTA</button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
                          <div>
                            <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-gray-500">
                              <span>Drag canvas</span>
                              <span>{mediaFormatLabel}</span>
                            </div>
                            <div className={`mx-auto max-h-[640px] w-full max-w-[420px] border border-gray-200 bg-white ${templatePreviewRatioClass}`}>
                              <div
                                ref={templateCanvasRef}
                                className="relative h-full w-full touch-none overflow-hidden"
                                style={{ background: `linear-gradient(135deg, ${templateAccent}18, #ffffff 52%, ${templateAccent}28)` }}
                                onPointerMove={onMoveTemplateDrag}
                                onPointerUp={onEndTemplateDrag}
                                onPointerCancel={onEndTemplateDrag}
                              >
                                {templateSafeZonesEnabled && (
                                  <div className="pointer-events-none absolute inset-0 z-40">
                                    <div className="absolute left-0 top-0 w-full bg-gray-950/25" style={{ height: `${activePlacementCrop.top}%` }} />
                                    <div className="absolute bottom-0 left-0 w-full bg-gray-950/25" style={{ height: `${activePlacementCrop.bottom}%` }} />
                                    <div className="absolute left-0 bg-gray-950/25" style={{ top: `${activePlacementCrop.top}%`, bottom: `${activePlacementCrop.bottom}%`, width: `${activePlacementCrop.left}%` }} />
                                    <div className="absolute right-0 bg-gray-950/25" style={{ top: `${activePlacementCrop.top}%`, bottom: `${activePlacementCrop.bottom}%`, width: `${activePlacementCrop.right}%` }} />
                                    <div className="absolute border-2 border-dashed border-amber-500 bg-amber-300/10 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]" style={{ left: `${activePlacementCrop.left}%`, top: `${activePlacementCrop.top}%`, right: `${activePlacementCrop.right}%`, bottom: `${activePlacementCrop.bottom}%` }} />
                                    <div className="absolute left-0 top-0 w-full bg-red-500/20" style={{ height: `${activeSafeArea.top}%` }} />
                                    <div className="absolute bottom-0 left-0 w-full bg-red-500/20" style={{ height: `${activeSafeArea.bottom}%` }} />
                                    <div className="absolute left-0 bg-red-500/20" style={{ top: `${activeSafeArea.top}%`, bottom: `${activeSafeArea.bottom}%`, width: `${activeSafeArea.left}%` }} />
                                    <div className="absolute right-0 bg-red-500/20" style={{ top: `${activeSafeArea.top}%`, bottom: `${activeSafeArea.bottom}%`, width: `${activeSafeArea.right}%` }} />
                                    <div className="absolute border-[3px] border-blue-600 bg-blue-500/[0.06] shadow-[0_0_0_2px_rgba(255,255,255,0.85),0_0_18px_rgba(37,99,235,0.35)]" style={{ left: `${activeSafeArea.left}%`, top: `${activeSafeArea.top}%`, right: `${activeSafeArea.right}%`, bottom: `${activeSafeArea.bottom}%` }} />
                                    <div className="absolute left-2 top-2 rounded-md bg-blue-600 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow">Blue area = safe text</div>
                                    <div className="absolute right-2 top-2 rounded-md bg-amber-500 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow">Orange = placement crop</div>
                                  </div>
                                )}
                                {templateGuides.vertical && <div className="pointer-events-none absolute left-1/2 top-0 z-30 h-full w-px -translate-x-1/2 bg-blue-500/80 shadow-[0_0_0_1px_rgba(37,99,235,0.25)]" />}
                                {templateGuides.horizontal && <div className="pointer-events-none absolute left-0 top-1/2 z-30 h-px w-full -translate-y-1/2 bg-blue-500/80 shadow-[0_0_0_1px_rgba(37,99,235,0.25)]" />}
                                {templateElements.map(element => {
                                  const selected = selectedTemplateElementId === element.id;
                                  const isLogoWithImage = element.type === 'logo' && element.src;
                                  const mediaSrc = element.type === 'media' ? (element.src || selectedProductMediaUrl) : '';
                                  const elementBackground = element.type === 'cta' ? (element.background || templateAccent) : element.type === 'media' ? (element.background || 'transparent') : element.background;
                                  const elementTextColor = element.color === 'dynamic' ? readableTemplateTextColor(elementBackground) : element.color;
                                  return (
                                    <div
                                      key={element.id}
                                      role="button"
                                      tabIndex={0}
                                      onPointerDown={event => onStartTemplateDrag(event, element)}
                                      onClick={() => onSelectTemplateElement(element.id)}
                                      className={`absolute z-20 flex cursor-move select-none items-center justify-center overflow-hidden border text-center transition ${selected ? 'border-blue-600 ring-2 ring-blue-200' : element.type === 'media' ? 'border-dashed border-gray-300' : 'border-transparent hover:border-blue-200'}`}
                                      style={{
                                        left: `${element.x}%`,
                                        top: `${element.y}%`,
                                        width: `${element.width}%`,
                                        height: `${element.height}%`,
                                        color: elementTextColor,
                                        background: elementBackground,
                                        fontSize: `${element.fontSize}px`,
                                        fontWeight: element.fontWeight,
                                        fontFamily: element.fontFamily || 'Inter',
                                      }}
                                    >
                                      {mediaSrc ? (
                                        <img src={mediaSrc} alt="Product media" className="h-full w-full object-contain" />
                                      ) : isLogoWithImage ? (
                                        <img src={element.src} alt="Logo" className="max-h-full max-w-full object-contain" />
                                      ) : element.type === 'media' ? (
                                        <div className="flex h-full w-full items-center justify-center bg-white/60 text-gray-400"><ImageIcon size={Math.min(48, Math.max(22, element.height))} strokeWidth={1.8} /></div>
                                      ) : (
                                        <span className="px-2 leading-tight">{element.text || element.label}</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="text-sm font-bold text-gray-950">Selected element</div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{selectedTemplateElement?.label || 'None'}</div>
                              </div>
                              {selectedTemplateElement && templateElements.length > 1 && (
                                <button type="button" onClick={() => onRemoveTemplateElement(selectedTemplateElement.id)} className="rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50">Remove</button>
                              )}
                            </div>
                            {selectedTemplateElement ? (
                              <div className="mt-3 space-y-3">
                                {selectedTemplateElement.type !== 'media' && (
                                  <label className="space-y-1">
                                    <span className="text-xs font-bold text-gray-700">Text</span>
                                    <input value={selectedTemplateElement.text} onChange={event => onUpdateTemplateElement(selectedTemplateElement.id, { text: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" />
                                  </label>
                                )}
                                {(selectedTemplateElement.type === 'logo' || selectedTemplateElement.type === 'media') && (
                                  <div className="space-y-2">
                                    {selectedTemplateElement.type === 'logo' && (
                                      <label className="flex cursor-pointer items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100">
                                        Upload logo
                                        <input type="file" accept="image/*" onChange={event => onUploadTemplateLogo(event, selectedTemplateElement.id)} className="sr-only" />
                                      </label>
                                    )}
                                    <label className="space-y-1">
                                      <span className="text-xs font-bold text-gray-700">{selectedTemplateElement.type === 'media' ? 'Product image URL' : 'Logo image URL'}</span>
                                      <input value={selectedTemplateElement.src?.startsWith('data:') ? '' : selectedTemplateElement.src || ''} onChange={event => onUpdateTemplateElement(selectedTemplateElement.id, { src: event.target.value })} placeholder={selectedTemplateElement.src?.startsWith('data:') ? 'Uploaded logo' : selectedTemplateElement.type === 'media' && selectedProductMediaUrl ? 'Using selected product image' : 'https://...'} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" />
                                      {selectedTemplateElement.type === 'logo' && selectedTemplateElement.src && <span className="block text-[11px] font-semibold text-gray-500">Logo is loaded on the canvas and will be saved with the template.</span>}
                                      {selectedTemplateElement.type === 'media' && selectedElementMediaUrl && <span className="block text-[11px] font-semibold text-gray-500">Rendering as a resizable image placement.</span>}
                                    </label>
                                  </div>
                                )}
                                {selectedTemplateElement.type !== 'media' && (
                                  <>
                                    <label className="space-y-1">
                                      <span className="text-xs font-bold text-gray-700">Font family</span>
                                      <select value={selectedTemplateElement.fontFamily || 'Inter'} onChange={event => onUpdateTemplateElement(selectedTemplateElement.id, { fontFamily: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                                        {TEMPLATE_FONT_FAMILIES.map(font => <option key={font} value={font}>{font}</option>)}
                                      </select>
                                    </label>
                                    <label className="space-y-1">
                                      <span className="text-xs font-bold text-gray-700">Font size {selectedTemplateElement.fontSize}px</span>
                                      <input type="range" min="8" max="64" value={selectedTemplateElement.fontSize} onChange={event => onUpdateTemplateElement(selectedTemplateElement.id, { fontSize: Number(event.target.value) })} className="w-full" />
                                    </label>
                                  </>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                  <label className="space-y-1">
                                    <span className="text-xs font-bold text-gray-700">Width {Math.round(selectedTemplateElement.width)}%</span>
                                    <input type="range" min="8" max="100" value={selectedTemplateElement.width} onChange={event => onUpdateTemplateElement(selectedTemplateElement.id, { width: Number(event.target.value) })} className="w-full" />
                                  </label>
                                  <label className="space-y-1">
                                    <span className="text-xs font-bold text-gray-700">Height {Math.round(selectedTemplateElement.height)}%</span>
                                    <input type="range" min="4" max={selectedTemplateElement.type === 'media' ? 100 : 70} value={selectedTemplateElement.height} onChange={event => onUpdateTemplateElement(selectedTemplateElement.id, { height: Number(event.target.value) })} className="w-full" />
                                  </label>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <label className="space-y-1">
                                    <span className="text-xs font-bold text-gray-700">X {Math.round(selectedTemplateElement.x)}%</span>
                                    <input type="range" min="0" max={100 - selectedTemplateElement.width} value={selectedTemplateElement.x} onChange={event => onUpdateTemplateElement(selectedTemplateElement.id, { x: Number(event.target.value) })} className="w-full" />
                                  </label>
                                  <label className="space-y-1">
                                    <span className="text-xs font-bold text-gray-700">Y {Math.round(selectedTemplateElement.y)}%</span>
                                    <input type="range" min="0" max={100 - selectedTemplateElement.height} value={selectedTemplateElement.y} onChange={event => onUpdateTemplateElement(selectedTemplateElement.id, { y: Number(event.target.value) })} className="w-full" />
                                  </label>
                                </div>
                                {selectedTemplateElement.type !== 'media' && (
                                  <>
                                    <div className="grid grid-cols-2 gap-2">
                                      <label className="space-y-1">
                                        <span className="text-xs font-bold text-gray-700">Text color</span>
                                        <select value={selectedTemplateElement.color === 'dynamic' ? 'dynamic' : 'custom'} onChange={event => onUpdateTemplateElement(selectedTemplateElement.id, { color: event.target.value === 'dynamic' ? 'dynamic' : readableTemplateTextColor(selectedTemplateElement.type === 'cta' ? selectedTemplateElement.background || templateAccent : selectedTemplateElement.background) })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                                          <option value="dynamic">Dynamic</option>
                                          <option value="custom">Custom</option>
                                        </select>
                                        {selectedTemplateElement.color === 'dynamic' ? (
                                          <span className="block text-[11px] font-semibold text-gray-500">Auto: dark text on light backgrounds, white text on dark backgrounds.</span>
                                        ) : (
                                          <input type="color" value={selectedTemplateElement.color === 'transparent' ? '#111827' : selectedTemplateElement.color} onChange={event => onUpdateTemplateElement(selectedTemplateElement.id, { color: event.target.value })} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 py-1" />
                                        )}
                                      </label>
                                      <label className="space-y-1">
                                        <span className="text-xs font-bold text-gray-700">Background</span>
                                        <input type="color" value={selectedTemplateElement.background.startsWith('#') ? selectedTemplateElement.background : templateAccent} onChange={event => onUpdateTemplateElement(selectedTemplateElement.id, { background: event.target.value })} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 py-1" />
                                      </label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {TEMPLATE_FONT_WEIGHTS.map(weight => (
                                        <button key={weight.value} type="button" onClick={() => onUpdateTemplateElement(selectedTemplateElement.id, { fontWeight: weight.value })} className={`rounded-lg px-2 py-2 text-xs font-bold ${selectedTemplateElement.fontWeight === weight.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>{weight.label}</button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            ) : (
                              <p className="mt-3 text-sm text-gray-600">Select an element on the canvas.</p>
                            )}
                          </div>
                        </div>

                        <div className={`mt-4 rounded-xl border p-3 ${templateSafeZonesEnabled ? 'border-blue-100 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="text-sm font-bold text-gray-950">Safe zones</div>
                              <p className="text-xs font-semibold text-gray-600">Off by default. Turn on to show overlays and keep elements inside the selected placement safe area.</p>
                            </div>
                            <button type="button" onClick={() => onToggleTemplateSafeZones(!templateSafeZonesEnabled)} className={`rounded-lg px-3 py-2 text-xs font-bold ${templateSafeZonesEnabled ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>{templateSafeZonesEnabled ? 'Safe zones on' : 'Safe zones off'}</button>
                          </div>
                          {templateSafeZonesEnabled && (
                            <>
                              <div className="mt-2 text-xs font-bold text-blue-700">{activeSafeZoneLabel}</div>
                              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                                {SAFE_ZONE_PRESETS.map(zone => (
                                  <button key={zone.id} type="button" onClick={() => onUpdateTemplateSafeZone(zone)} className={`rounded-lg px-2 py-2 text-xs font-bold ${templateSafeZoneId === zone.id ? 'bg-blue-600 text-white' : 'bg-white text-blue-800 hover:bg-blue-100'}`}>{zone.label}</button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
                          <button
                            type="button"
                            onClick={onSaveTemplate}
                            disabled={templateBusy}
                            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                          >
                            {templateBusy ? 'Saving...' : 'Save template'}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-gray-950">Saved templates</h3>
                            <p className="mt-1 text-sm text-gray-600">Select templates here or inside Create ads.</p>
                          </div>
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{selectedTemplateIds.length} selected</span>
                        </div>
                        {savedTemplates.length ? (
                          <div className="mt-4 grid grid-cols-1 gap-3">
                            {savedTemplates.map(template => {
                              const templateId = String(template.id || '');
                              const selected = selectedTemplateIds.includes(templateId);
                              return (
                                <button key={templateId} type="button" onClick={() => onToggleTemplateSelection(templateId)} className={`w-full rounded-xl border p-4 text-left transition ${selected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="truncate font-bold text-gray-950">{String(template.name || 'Untitled template')}</div>
                                      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{formatTemplateSummary(template)}</div>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{selected ? 'Selected' : 'Select'}</span>
                                  </div>
                                  <div className="mt-3 rounded-lg border border-gray-100 bg-linear-to-br from-gray-50 to-white p-3">
                                    <div className="h-7 w-24 rounded-sm" style={{ backgroundColor: String(templateAccent) }} />
                                    <div className="mt-3 h-2 w-3/4 rounded bg-gray-200" />
                                    <div className="mt-2 h-2 w-1/2 rounded bg-gray-100" />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : <EmptyState text="No templates saved yet. Build one above and save it." />}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <h3 className="font-bold text-gray-950">Element layers</h3>
                      <p className="mt-1 text-sm text-gray-600">Click a layer or click the canvas. Dragging stays inside the selected ratio so templates remain ad-safe.</p>
                      <div className="mt-4 space-y-2">
                        {templateElements.map(element => {
                          const selected = selectedTemplateElementId === element.id;
                          return (
                            <button
                              key={element.id}
                              type="button"
                              onClick={() => onSelectTemplateElement(element.id)}
                              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${selected ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold">{element.label}</span>
                                <span className="text-xs font-semibold uppercase tracking-wide">{element.type}</span>
                              </div>
                              <div className="mt-1 truncate text-xs text-gray-500">{element.text || 'No text'}</div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-950">
                        <div className="font-bold">Saved data</div>
                        <p className="mt-1">Template saves the exact X/Y position, size, font, colors, logo URL, media slots and ratio for later ad builds.</p>
                      </div>
                    </div>
                  </div>
    </Panel>
  );
}

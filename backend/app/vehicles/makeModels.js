// Fixed combo-box values for Feature 4. The options endpoint and create/update validation share this list.
export const MODELS_BY_MAKE = {
  Chevrolet: ["Express", "Malibu", "Silverado", "Suburban", "Tahoe"],
  Ford: ["Escape", "Explorer", "F-150", "Transit", "Transit Connect"],
  GMC: ["Savana", "Sierra", "Terrain", "Yukon"],
  Honda: ["Odyssey", "Pilot"],
  Jeep: ["Cherokee", "Grand Cherokee", "Wrangler"],
  Nissan: ["Frontier", "NV200", "Pathfinder"],
  Ram: ["1500", "ProMaster"],
  Toyota: ["Camry", "Highlander", "Sienna", "Tacoma"],
  "Club Car": ["Carryall", "Onward"],
  Other: ["Other"],
};

export const MAKES = Object.keys(MODELS_BY_MAKE);

export const isAllowedMakeModel = (make, model) =>
  Object.prototype.hasOwnProperty.call(MODELS_BY_MAKE, make) && MODELS_BY_MAKE[make].includes(model);

export const optionsPayload = () => ({
  makes: [...MAKES],
  modelsByMake: Object.fromEntries(MAKES.map((make) => [make, [...MODELS_BY_MAKE[make]]])),
});

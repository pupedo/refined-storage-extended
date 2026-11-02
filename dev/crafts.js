function addShapedGlassDual(result, mask, data) {
	var glassItemIds = [20, 241];
	for (var glassIndex = 0; glassIndex < glassItemIds.length; glassIndex++) {
		var maskWithGlass = data.slice();
		for (var maskIndex = 0; maskIndex < maskWithGlass.length; maskIndex += 3) {
			if (maskWithGlass[maskIndex] == 'g') maskWithGlass[maskIndex + 1] = glassItemIds[glassIndex];
		}
		Recipes.addShaped(result, mask, maskWithGlass);
	}
}

Callback.addCallback("PostLoaded", function () {
	ModAPI.addAPICallback("RefinedStorageAPI", function (api) {
		if (!api) {
			RSE.log("recipes skipped: RefinedStorageAPI unavailable");
			return;
		}
		if (!RSE.apiAtLeast(api, 2, 0)) {
			RSE.log("recipes skipped: RefinedStorageAPI 2.0 required");
			return;
		}
		if (!api.energy || typeof api.energy.set !== 'function') {
			RSE.log("recipes skipped: RefinedStorageAPI energy API unavailable");
			return;
		}

		var quartzEnrichedIronItemId = coreId("quartz_enriched_iron");
		var advancedProcessorItemId = coreId("advanced_processor");
		var rawAdvancedProcessorItemId = coreId("raw_advanced_processor");
		var rawImprovedProcessorItemId = coreId("raw_improved_processor");
		var processorBindingItemId = coreId("processor_binding");
		var storageHousingItemId = coreId("storage_housing");
		var constructionCoreItemId = coreId("construction_core");
		var refinedStorageUpgradeItemId = coreId("rs_upgrade");
		var rangeUpgradeItemId = coreId("RSRangeUpgrade");
		var core64kStoragePartItemId = coreId("64k_storage_part");

		if (!RSE.hasCoreIds([quartzEnrichedIronItemId, advancedProcessorItemId, rawAdvancedProcessorItemId, rawImprovedProcessorItemId, processorBindingItemId, storageHousingItemId, constructionCoreItemId, refinedStorageUpgradeItemId, rangeUpgradeItemId, core64kStoragePartItemId])) {
			RSE.log("recipes skipped: missing core items");
			return;
		}

		var storagePartItemIds = [];
		for (var storagePartIndex = 0; storagePartIndex < RSE_ITEMS.parts.length; storagePartIndex++) {
			storagePartItemIds.push(RSE.requireItem(RSE_ITEMS.parts[storagePartIndex].id));
		}

		for (var storageDiskIndex = 0; storageDiskIndex < RSE_ITEMS.disks.length; storageDiskIndex++) {
			var storageDiskDefinition = RSE_ITEMS.disks[storageDiskIndex];
			var storageDiskItemId = RSE.requireItem(storageDiskDefinition.id);
			var storagePartItemId = RSE.requireItem(storageDiskDefinition.partId);
			if (!storageDiskItemId || !storagePartItemId) {
				RSE.log("recipe skipped: missing disk or part for " + storageDiskDefinition.id);
				continue;
			}
			addShapedGlassDual({ id: storageDiskItemId, count: 1, data: 0 }, ["grg", "rsr", "iii"],
				['g', 20, -1, 'r', 331, -1, 's', storagePartItemId, -1, 'i', quartzEnrichedIronItemId, -1]);
			Recipes.addShapeless({ id: storageDiskItemId, count: 1, data: 0 },
				[{ id: storageHousingItemId, count: 1, data: -1 }, { id: storagePartItemId, count: 1, data: -1 }]);
		}

		var storagePartUpgradeLadder = [
			{ storagePartIndex: 0, previousPartItemId: core64kStoragePartItemId },
			{ storagePartIndex: 1, previousPartItemId: storagePartItemIds[0] },
			{ storagePartIndex: 2, previousPartItemId: storagePartItemIds[1] },
			{ storagePartIndex: 3, previousPartItemId: storagePartItemIds[2] }
		];
		for (var ladderIndex = 0; ladderIndex < storagePartUpgradeLadder.length; ladderIndex++) {
			var ladderEntry = storagePartUpgradeLadder[ladderIndex];
			var ladderPartItemId = storagePartItemIds[ladderEntry.storagePartIndex];
			if (!ladderPartItemId || !ladderEntry.previousPartItemId) {
				RSE.log("recipe skipped: missing part ladder ingredient for " + RSE_ITEMS.parts[ladderEntry.storagePartIndex].id);
				continue;
			}
			Recipes.addShaped({ id: ladderPartItemId, count: 1, data: 0 }, ["did", "grg", "dgd"],
				['d', advancedProcessorItemId, -1, 'i', quartzEnrichedIronItemId, -1, 'g', ladderEntry.previousPartItemId, -1, 'r', 331, -1]);
		}

		var rawNeuralProcessorItemId = RSE.requireItem(RSE_ITEMS.processors.raw.id);
		var neuralProcessorItemId = RSE.requireItem(RSE_ITEMS.processors.neural.id);
		if (rawNeuralProcessorItemId) {
			Recipes.addShaped({ id: rawNeuralProcessorItemId, count: 1, data: 0 }, ["cbd", "bab", "efe"],
				['c', rawAdvancedProcessorItemId, -1, 'b', 406, -1, 'd', rawImprovedProcessorItemId, -1, 'a', 58, -1, 'e', 49, -1, 'f', processorBindingItemId, -1]);
			if (neuralProcessorItemId) {
				Recipes.addFurnace(rawNeuralProcessorItemId, 0, neuralProcessorItemId, 0);
			} else {
				RSE.log("recipe skipped: missing " + RSE_ITEMS.processors.neural.id);
			}
		} else {
			RSE.log("recipe skipped: missing " + RSE_ITEMS.processors.raw.id);
		}

		var craftingUpgradeItemId = RSE.requireItem(RSE_ITEMS.processors.craftingUpgrade.id);
		if (craftingUpgradeItemId) {
			Recipes.addShaped({ id: craftingUpgradeItemId, count: 1, data: 0 }, ["eoe", "cuc", "eee"],
				['e', quartzEnrichedIronItemId, -1, 'o', constructionCoreItemId, -1, 'c', 58, -1, 'u', refinedStorageUpgradeItemId, -1]);
		} else {
			RSE.log("recipe skipped: missing " + RSE_ITEMS.processors.craftingUpgrade.id);
		}

		var infinityRangeBoosterItemId = RSE.requireItem(RSE_ITEMS.cards[0].id);
		var dimensionCardItemId = RSE.requireItem(RSE_ITEMS.cards[1].id);
		if (infinityRangeBoosterItemId) {
			Recipes.addShaped({ id: infinityRangeBoosterItemId, count: 1, data: 0 }, ["ere", "rsr", "nnn"],
				['e', 381, -1, 'r', rangeUpgradeItemId, -1, 's', 776, -1, 'n', 738, -1]);
		} else {
			RSE.log("recipe skipped: missing " + RSE_ITEMS.cards[0].id);
		}
		if (infinityRangeBoosterItemId && dimensionCardItemId) {
			Recipes.addShaped({ id: dimensionCardItemId, count: 1, data: 0 }, ["rnr", "nen", "rnr"],
				['r', infinityRangeBoosterItemId, -1, 'n', 776, -1, 'e', 381, -1]);
		} else {
			RSE.log("recipe skipped: missing upgrade card for " + RSE_ITEMS.cards[1].id);
		}

		var machineCasingBlockId = coreId("RSmachine_casing");
		var improvedProcessorItemId = coreId("improved_processor");

		if (BlockID.RSE_detector) {
			if (!machineCasingBlockId || !improvedProcessorItemId) {
				RSE.log("recipe skipped: missing core items for detector");
			} else {
				Recipes.addShaped({ id: BlockID.RSE_detector, count: 1, data: 0 }, ["ere", "cmc", "epe"],
					['e', quartzEnrichedIronItemId, -1, 'c', 404, -1, 'r', 76, -1, 'm', machineCasingBlockId, -1, 'p', improvedProcessorItemId, -1]);
			}
		}
		if (BlockID.RSE_requester && BlockID.RSE_detector) {
			if (!machineCasingBlockId || !advancedProcessorItemId) {
				RSE.log("recipe skipped: missing core items for requester");
			} else if (craftingUpgradeItemId) {
				Recipes.addShaped({ id: BlockID.RSE_requester, count: 1, data: 0 }, ["rdr", "cfc", "rpr"],
					['r', 331, -1, 'd', BlockID.RSE_detector, -1, 'c', craftingUpgradeItemId, -1, 'f', machineCasingBlockId, -1, 'p', advancedProcessorItemId, -1]);
			} else {
				RSE.log("recipe skipped: missing " + RSE_ITEMS.processors.craftingUpgrade.id);
			}
		}

		var crafterBaseBlockId = coreId("RS_crafter");
		// VanillaBlockID is the block ID used by recipe matching for vanilla blocks; -258 is the netherite block fallback.
		var netheriteBlockItemId = (typeof VanillaBlockID !== "undefined" && VanillaBlockID && VanillaBlockID.netherite_block) ? VanillaBlockID.netherite_block : -258;
		var crafterRecipeTiers = [
			{ blockId: "RSE_crafter_iron", materialItemId: 265, previousTierIndex: 0 },
			{ blockId: "RSE_crafter_gold", materialItemId: 41, previousTierIndex: 0 },
			{ blockId: "RSE_crafter_diamond", materialItemId: 57, previousTierIndex: 1 },
			{ blockId: "RSE_crafter_netherite", materialItemId: netheriteBlockItemId, previousTierIndex: 2 }
		];
		if (!crafterBaseBlockId) {
			RSE.log("recipe skipped: missing core item RS_crafter");
		} else {
			for (var crafterIndex = 0; crafterIndex < crafterRecipeTiers.length; crafterIndex++) {
				var crafterRecipeTier = crafterRecipeTiers[crafterIndex];
				if (!BlockID[crafterRecipeTier.blockId]) continue;
				if (crafterIndex == 0) {
					Recipes.addShaped({ id: BlockID[crafterRecipeTier.blockId], count: 1, data: 0 }, ["aca", " b ", "a a"],
						['a', crafterRecipeTier.materialItemId, -1, 'c', 54, -1, 'b', crafterBaseBlockId, -1]);
				} else {
					if (!neuralProcessorItemId) {
						RSE.log("recipe skipped: missing " + RSE_ITEMS.processors.neural.id);
						continue;
					}
					var previousCrafterBlockId = BlockID[crafterRecipeTiers[crafterRecipeTier.previousTierIndex].blockId];
					if (!previousCrafterBlockId) {
						RSE.log("recipe skipped: missing previous crafter tier " + crafterRecipeTiers[crafterRecipeTier.previousTierIndex].blockId);
						continue;
					}
					Recipes.addShaped({ id: BlockID[crafterRecipeTier.blockId], count: 1, data: 0 }, ["ada", "cbc", "a a"],
						['a', crafterRecipeTier.materialItemId, -1, 'd', 54, -1, 'c', neuralProcessorItemId, -1, 'b', previousCrafterBlockId, -1]);
				}
			}
		}

		var wirelessCraftingGridItemId = RSE.requireItem(RSE_ITEMS.wcg.id);
		if (wirelessCraftingGridItemId) {
			var wirelessCraftingGridBlockId = coreId("RS_crafting_grid");
			if (!wirelessCraftingGridBlockId) {
				RSE.log("recipe skipped: missing core item RS_crafting_grid");
			} else {
				Recipes.addShaped({ id: wirelessCraftingGridItemId, count: 1, data: 0 }, ["epe", "ege", "eae"],
					['e', quartzEnrichedIronItemId, -1, 'p', 368, -1, 'g', wirelessCraftingGridBlockId, -1, 'a', advancedProcessorItemId, -1], function (recipeApi, field, result, player) {
						if (RSEChargeRegistry) {
							result.data = 27;
							result.extra = new ItemExtraData().putInt('energy', 0);
						}
					});
			}
		} else {
			RSE.log("recipe skipped: missing " + RSE_ITEMS.wcg.id);
		}

		if (BlockID.RSE_storage_256k) {
			if (!machineCasingBlockId) {
				RSE.log("recipe skipped: missing core item RSmachine_casing");
			} else {
				var storageBlockRecipeTiers = [
					{ blockId: "RSE_storage_256k", storagePartIndex: 0 },
					{ blockId: "RSE_storage_1024k", storagePartIndex: 1 },
					{ blockId: "RSE_storage_4096k", storagePartIndex: 2 },
					{ blockId: "RSE_storage_16384k", storagePartIndex: 3 }
				];
				for (var storageBlockIndex = 0; storageBlockIndex < storageBlockRecipeTiers.length; storageBlockIndex++) {
					var storageBlockRecipeTier = storageBlockRecipeTiers[storageBlockIndex];
					var storageBlockPartItemId = storagePartItemIds[storageBlockRecipeTier.storagePartIndex];
					if (!storageBlockPartItemId) {
						RSE.log("recipe skipped: missing " + RSE_ITEMS.parts[storageBlockRecipeTier.storagePartIndex].id);
						continue;
					}
					Recipes.addShaped({ id: BlockID[storageBlockRecipeTier.blockId], count: 1, data: 0 }, ["epe", "eme", "ere"],
						['e', quartzEnrichedIronItemId, -1, 'p', storageBlockPartItemId, -1, 'm', machineCasingBlockId, -1, 'r', 331, -1]);
				}
			}
		}

		RSE.logDev("recipes registered");
	});
});

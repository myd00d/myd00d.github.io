define([
	'ash',
    'utils/MathUtils',
	'game/constants/WorldConstants',
	'game/constants/UpgradeConstants',
    'worldcreator/WorldCreatorHelper',
    'worldcreator/WorldCreatorRandom',
], function (
    Ash, MathUtils, WorldConstants, UpgradeConstants, WorldCreatorHelper, WorldCreatorRandom
) {
    var context = "WorldValidator";

    var WorldValidator = {

        validateWorld: function (worldVO) {
            worldVO.resetPaths();
        
            var worldChecks = [ this.checkSeed ];
            for (var i = 0; i < worldChecks.length; i++) {
                var checkResult = worldChecks[i](worldVO);
                if (!checkResult.isValid) {
                    return { isValid: false, reason: checkResult.reason };
                }
            }
            
            var levelChecks = [ this.checkCriticalPaths, this.checkContinuousEarlyStage, this.checkCampsAndPassages, this.checkNumberOfSectors ];
			for (var l = worldVO.topLevel; l >= worldVO.bottomLevel; l--) {
                var levelVO = worldVO.levels[l];
                for (var i = 0; i < levelChecks.length; i++) {
                    var checkResult = levelChecks[i](worldVO, levelVO);
                    if (!checkResult.isValid) {
                        return { isValid: false, reason: checkResult.reason };
                    }
                }
            }
            
            var campChecks = [ this.checkNumberOfLocales ];
            for (var i = 0; i < WorldConstants.CAMPS_TOTAL; i++) {
                var levels = WorldCreatorHelper.getLevelsForCamp(worldVO.seed, i);
                var levelVOs = levels.map(level => worldVO.getLevel(level));
                for (var j = 0; j < campChecks.length; j++) {
                    var checkResult = campChecks[j](worldVO, i, levelVOs);
                    if (!checkResult.isValid) {
                        return { isValid: false, reason: checkResult.reason };
                    }
                }
            }
            
            return { isValid: true };
        },
        
        checkSeed: function (worldVO) {
            return { isValid: true };
        },
        
        checkCriticalPaths: function (worldVO, levelVO) {
            var requiredPaths = WorldCreatorHelper.getRequiredPaths(worldVO, levelVO);
            for (var i = 0; i < requiredPaths.length; i++) {
                var path = requiredPaths[i];
                var startPos = path.start.clone();
                var endPos = path.end.clone();
                if (startPos.equals(endPos)) continue;
                var sectorPath = WorldCreatorRandom.findPath(worldVO, startPos, endPos, false, true, path.stage);
                if (!sectorPath || sectorPath.length < 1) {
                    return { isValid: false, reason: "required path " + path.type + " on level " + levelVO.level + " is missing" };
                }
                if (path.maxlen > 0 && sectorPath.length > path.maxlen) {
                    return { isValid: false, reason: "required path " + path.type + " on level " + levelVO.level + " is too long (" + sectorPath.length + "/" + path.maxlen + ")" };
                }
            }
            return { isValid: true };
        },
        
        checkNumberOfSectors: function (worldVO, levelVO) {
            // NOTE: sectors per stage is a minimum used for evidence balancing etc, a bit of overshoot is ok
            if (levelVO.sectors.length < levelVO.numSectors) {
                return { isValid: false, reason: "too few sectors on level " + levelVO.level };
            }
            if (levelVO.sectors.length > levelVO.maxSectors) {
                return { isValid: false, reason: "too many sectors on level " + levelVO.level };
            }
            var stages = [ WorldConstants.CAMP_STAGE_EARLY, WorldConstants.CAMP_STAGE_LATE ];
            for (var i = 0; i < stages.length; i++) {
                var stage = stages[i];
                var numSectorsCreated = levelVO.getNumSectorsByStage(stage);
                var numSectorsPlanned = levelVO.numSectorsByStage[stage];
                if (numSectorsCreated < numSectorsPlanned) {
                    return { isValid: false, reason: "too few sectors on level " + levelVO.level + " stage " + stage };
                }
                if (numSectorsCreated > numSectorsPlanned * 1.1) {
                    return { isValid: false, reason: "too many sectors on level " + levelVO.level + " stage " + stage };
                }
            }
            return { isValid: true };
        },
        
        checkNumberOfLocales: function (worldVO, campOrdinal, levelVOs) {
            var numEarlyLocales = 0;
            var numLateLocales = 0;
            for (var i = 0; i < levelVOs.length; i++) {
                var levelVO = levelVOs[i];
                for (var s = 0; s < levelVO.sectors.length; s++) {
                    var sectorVO = levelVO.sectors[s];
                    if (sectorVO.locales.length > 0) {
                        for (var l = 0; l < sectorVO.locales.length; l++) {
                            var isEarly = sectorVO.locales[l].isEarly;
                            if (isEarly) {
                                numEarlyLocales++;
                            } else {
                                numLateLocales++;
                            }
                        }
                    }
                }
            }
            var numEarlyBlueprints = UpgradeConstants.getPiecesByCampOrdinal(campOrdinal, UpgradeConstants.BLUEPRINT_TYPE_EARLY);
            if (numEarlyLocales < numEarlyBlueprints) {
                return { isValid: false, reason: "too few early locales for camp ordinal " + campOrdinal + " " + numEarlyLocales + "/" + numEarlyBlueprints };
            }
            var numLateBlueprints = UpgradeConstants.getPiecesByCampOrdinal(campOrdinal, UpgradeConstants.BLUEPRINT_TYPE_LATE);
            if (numLateLocales < numLateBlueprints) {
                return { isValid: false, reason: "too few late locales for camp ordinal " + campOrdinal + " " + numLateLocales + "/" + numLateBlueprints };
            }
            return { isValid: true };
        },
        
        checkContinuousEarlyStage: function (worldVO, levelVO) {
            var earlySectors = levelVO.sectorsByStage[WorldConstants.CAMP_STAGE_EARLY];
            if (earlySectors && earlySectors.length > 1) {
                for (var j = 1; j < earlySectors.length; j++) {
                    var sectorPath = WorldCreatorRandom.findPath(worldVO, earlySectors[0].position, earlySectors[j].position, false, true, WorldConstants.CAMP_STAGE_EARLY);
                    if (!sectorPath || sectorPath.length < 1) {
                        return { isValid: false, reason: "early stage is not continuous on level " + levelVO.level };
                    }
                }
            }
            return { isValid: true };
        },
        
        checkCampsAndPassages: function (worldVO, levelVO) {
            var pois = [];
            
            // passages up
            if (levelVO.level != worldVO.topLevel) {
                if (!levelVO.passageUpPosition) {
                    return { isValid: false, reason: "level " + levelVO.level + " missing passage up position" };
                }
                var sector = levelVO.getSector(levelVO.passageUpPosition.sectorX, levelVO.passageUpPosition.sectorY);
                if (!sector) {
                    return { isValid: false, reason: "level " + levelVO.level + " missing passage up sector" };
                }
                pois.push(levelVO.passageUpPosition);
            }
            
            // camps
            if (levelVO.isCampable) {
                if (levelVO.campPositions.length <= 0) {
                    return { isValid: false, reason: "campable level " + levelVO.level + " missing camp positions" };
                }
                for (var i = 0; i < levelVO.campPositions.length; i++) {
                    var pos = levelVO.campPositions[i];
                    var sector = levelVO.getSector(pos.sectorX, pos.sectorY);
                    if (!sector) {
                        return { isValid: false, reason: "camp position " + pos + " has no sector" };
                    }
                    pois.push(pos);
                }
            } else {
                if (levelVO.campPositions.length > 0) {
                    return { isValid: false, reason: "non-campable level " + levelVO.level + " has camp positions" };
                }
            }
            
            // passages down
            if (levelVO.level != worldVO.bottomLevel) {
                if (!levelVO.passageDownPosition) {
                    return { isValid: false, reason: "level " + levelVO.level + " missing passage down position" };
                }
                var sector = levelVO.getSector(levelVO.passageDownPosition.sectorX, levelVO.passageDownPosition.sectorY);
                if (!sector) {
                    return { isValid: false, reason: "level " + levelVO.level + " missing passage down sector" };
                }
                pois.push(levelVO.passageDownPosition);
            }
            
            // connections
            if (pois.length > 1) {
                for (var i = 0; i < pois.length - 1; i++) {
                    if (pois[i].equals(pois[i + 1])) continue;
                    var sectorPath = WorldCreatorRandom.findPath(worldVO, pois[i], pois[i + 1], false, true, null);
                    if (!sectorPath || sectorPath.length < 1) {
                        return { isValid: false, reason: "level " + levelVO.level + " pois not connected: " + pois[i] +  " " + pois[i + 1] };
                    }
                }
            }
            
            return { isValid: true };
        }

    };

    return WorldValidator;
});
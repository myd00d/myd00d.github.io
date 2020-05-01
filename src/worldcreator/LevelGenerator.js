// Handles the first step of world generation, the abstract world template itself
define([
	'ash',
    'game/constants/PositionConstants',
    'game/constants/WorldConstants',
    'game/vos/PositionVO',
	'worldcreator/WorldCreatorConstants',
    'worldcreator/WorldCreatorHelper',
    'worldcreator/WorldCreatorRandom',
	'worldcreator/LevelVO',
	'worldcreator/ZoneVO',
], function (Ash, PositionConstants, WorldConstants, PositionVO, WorldCreatorConstants, WorldCreatorHelper, WorldCreatorRandom, LevelVO, ZoneVO) {
    
    var LevelGenerator = {
        
        prepareLevels: function (seed, worldVO) {
			var topLevel = WorldCreatorHelper.getHighestLevel(seed);
			var bottomLevel = WorldCreatorHelper.getBottomLevel(seed);
            
			for (var l = topLevel; l >= bottomLevel; l--) {
                var isCampableLevel = WorldCreatorHelper.isCampableLevel(seed, l);
                var isHardLevel = WorldCreatorHelper.isHardLevel(seed, l);
                var notCampableReason = isCampableLevel ? null : WorldCreatorHelper.getNotCampableReason(seed, l);
                var ordinal = WorldCreatorHelper.getLevelOrdinal(seed, l);
                var campOrdinal = WorldCreatorHelper.getCampOrdinal(seed, l);
                var populationFactor = isCampableLevel ? WorldCreatorConstants.getPopulationFactor(campOrdinal) : 0;
                var isSmallLevel = WorldCreatorHelper.isSmallLevel(seed, l);
                var numSectors = WorldCreatorConstants.getNumSectors(campOrdinal, isSmallLevel);
                
                var levelVO = new LevelVO(l, ordinal, campOrdinal, isCampableLevel, isHardLevel, notCampableReason, populationFactor, numSectors);
                levelVO.campPositions = worldVO.campPositions[l];
                levelVO.passageUpPosition = worldVO.passagePositions[l].up;
                levelVO.passageDownPosition = worldVO.passagePositions[l].down;
                levelVO.numSectorsByStage[WorldConstants.CAMP_STAGE_EARLY] = WorldCreatorHelper.getNumSectorsForLevelStage(worldVO, levelVO, WorldConstants.CAMP_STAGE_EARLY);
                levelVO.numSectorsByStage[WorldConstants.CAMP_STAGE_LATE] = WorldCreatorHelper.getNumSectorsForLevelStage(worldVO, levelVO, WorldConstants.CAMP_STAGE_LATE);
                levelVO.stageCenterPositions = this.getStageCenterPositions(worldVO, levelVO);
                levelVO.levelCenterPosition = this.getLevelCenterPosition(worldVO, levelVO);
                levelVO.excursionStartPosition = this.getExcursionStartPosition(worldVO, levelVO);
                levelVO.zones = this.generateZones(seed, levelVO);
                worldVO.addLevel(levelVO);
            }
        },
        
        generateZones: function (seed, levelVO) {
            var result = [];
            result.push(new ZoneVO(levelVO.campOrdinal, WorldConstants.ZONE_ENTRANCE));
            if (levelVO.isCampable) {
                if (levelVO.level != 13) {
                    result.push(new ZoneVO(levelVO.campOrdinal, WorldConstants.ZONE_PASSAGE_TO_CAMP));
                }
                result.push(new ZoneVO(levelVO.campOrdinal, WorldConstants.ZONE_POI_1));
                result.push(new ZoneVO(levelVO.campOrdinal, WorldConstants.ZONE_POI_2));
                result.push(new ZoneVO(levelVO.campOrdinal, WorldConstants.ZONE_CAMP_TO_PASSAGE));
                result.push(new ZoneVO(levelVO.campOrdinal, WorldConstants.ZONE_EXTRA_CAMPABLE));
            } else {
                result.push(new ZoneVO(levelVO.campOrdinal, WorldConstants.ZONE_PASSAGE_TO_PASSAGE));
                result.push(new ZoneVO(levelVO.campOrdinal, WorldConstants.ZONE_EXTRA_UNCAMPABLE));
            }
            return result;
        },
        
        getStageCenterPositions: function (worldVO, levelVO) {
            var result = {};
            var level = levelVO.level;
            var stages = worldVO.getStages(level);
            if (stages.length == 1) {
                result[stages[0].stage] = [ new PositionVO(level, 0, 0) ];
            } else {
                for (var i = 0; i < stages.length; i++) {
                    var stageVO = stages[i];
                    var positions = [];
                    switch (stageVO.stage) {
                        case WorldConstants.CAMP_STAGE_EARLY:
                            positions = positions.concat(levelVO.campPositions);
                            if (level < 13 && levelVO.passageUpPosition) {
                                positions.push(levelVO.passageUpPosition);
                            }
                            if (level > 13 && levelVO.passageDownPosition) {
                                positions.push(levelVO.passageDownPosition);
                            }
                            break;
                        case WorldConstants.CAMP_STAGE_LATE:
                            if (level <= 13 && levelVO.passageDownPosition) {
                                positions.push(levelVO.passageDownPosition);
                            }
                            if (level >= 13 && levelVO.passageUpPosition) {
                                positions.push(levelVO.passageUpPosition);
                            }
                            break;
                    }
                    result[stageVO.stage] = positions;
                }
            }
            return result;
        },
        
        getLevelCenterPosition: function (worldVO, levelVO) {
            var pois = [];
            if (levelVO.isCampable) {
                pois.push(new PositionVO(levelVO.level, 0, 0));
                pois = pois.concat(levelVO.campPositions);
            } else {
                if (levelVO.passageUpPosition) pois.push(levelVO.passageUpPosition);
                if (levelVO.passageDownPosition) pois.push(levelVO.passageDownPosition);
            }
            var result = PositionConstants.getMiddlePoint(pois, true);
            return result;
        },
        
        getExcursionStartPosition: function (worldVO, levelVO) {
            if (levelVO.isCampable) {
                return PositionConstants.getMiddlePoint(levelVO.campPositions);
            }
            if (levelVO.level < 13) {
                return levelVO.passageUpPosition;
            }
            return levelVO.passageDownPosition;
        }
        
    };
    
    return LevelGenerator;
});
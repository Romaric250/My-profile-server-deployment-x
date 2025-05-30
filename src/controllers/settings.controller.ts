import { Request, Response } from "express";
import { SettingsService } from "../services/settings.service"
import createHttpError from 'http-errors';
import { ProfileModel } from "../models/profile.model";
export class SettingsController {
  public settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  // POST /settings
  public createDefault = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req.user as any)?._id;
      if (!userId) throw createHttpError(401, 'Unauthorized');

      const settings = await this.settingsService.createDefault(userId);

      res.status(201).json(settings);
    } catch (error: any) {
      console.error("Create default settings error:", error);
      res.status(500).json({ message: "Failed to create default settings", error: error.message });
    }
  };

  public generatesettings = async (req:Request, res:Response): Promise<void> => {
    try {

      await this.settingsService.generateDefaultsForAllUsers()
      res.status(200).json("settings generated for all users that did not have. ")
      
    } catch (error:any) {
      res.status(500).json({message:"failed to generate settings",error:error.message})
      
    }
  }

  // GET /settings/:userId
  public getSettings = async (req: Request, res: Response): Promise<void> => {
    try {

      const userId = (req.user as any)?._id;
      const currentProfileId = (req.params as any).pId;

      console.log("current Profile Id", currentProfileId)

      const currentProfile = await ProfileModel.findById(currentProfileId)


      if (!userId) throw createHttpError(401, 'Unauthorized');

      const settings = await this.settingsService.getSettings(userId, currentProfileId);
      if (!settings) throw createHttpError(404, 'Settings not found');

      // const newSettings = {
      //   ...settings,
      //   ...currentProfile?.specificSettings
      // }

      res.status(200).json(settings);
    } catch (error: any) {
      console.error("Get settings error:", error);
      res.status(500).json({ message: "Failed to get settings", error: error.message });
    }
  };

  // PATCH /settings/:userId
  public updateSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req.user as any)?._id;
      const profileId = (req.params as any).profileId;
      if (!userId) throw createHttpError(401, 'Unauthorized');

      const updates = req.body;

      if (!updates || typeof updates !== "object")  {
        throw createHttpError(400, 'Valid update data is required');
      }
      const updated = await this.settingsService.updateSettings(userId, profileId, updates);
      if (!updated)  {
        res.status(404).json({ message: "Settings not found" });
      }

      res.status(200).json(updated);
    } catch (error: any) {
      console.log("Update settings error:", error);
      res.status(500).json({ message: "Failed to update settings", error: error.message });
    }
  };






public generateProfileSpecificSettingsforAllProfiles = async (req:Request, res:Response): Promise<void> => {
  try {
    const profiles = await ProfileModel.find({})
    await this.settingsService.generateProfileSpecificSettingsforAllProfiles(profiles)

    res.status(200).json({message:"profile specific settings generated for all profiles"})
  } catch (error:any) {
    res.status(500).json({message:"failed to generate profile specific settings",error:error.message})
  }
}




}

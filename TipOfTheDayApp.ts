import {
    IAppAccessors,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo, RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IPostRoomUserJoined, IRoom, IRoomUserJoinedContext, RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { IPostUserCreated, IPostUserLoggedIn, IUser, IUserContext } from '@rocket.chat/apps-engine/definition/users';
import { sendDirectMessage } from './src/lib/message';
import { getRandomTip, tipOfTheDay, welcomeMessage } from './src/lib/tips';

export class TipOfTheDayApp extends App implements IPostUserCreated, IPostUserLoggedIn, IPostRoomUserJoined {
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    public async executePostUserCreated(context: IUserContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify): Promise<void> {
        if (context.performedBy) {
            this.getLogger().log('User created by another user');
            return;
        }

        const tip = getRandomTip();
        const blocks = modify.getCreator().getBlockBuilder();

        if (tip.image) {
            blocks.addImageBlock({ imageUrl: tip.image, altText: 'Tip of the Day' });
        }

        // For future self: get user's language and translate accordingly
        await sendDirectMessage(read, modify, context.user, welcomeMessage.replace('%s', tip.message), blocks);
    }

    public async executePostUserLoggedIn(user: IUser, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify): Promise<void> {
        const [loginInfo = { loginCount: 1, lastLogin: new Date() }] = await read.getPersistenceReader().readByAssociations([
            new RocketChatAssociationRecord(RocketChatAssociationModel.USER, user.id),
            new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'loginInfo'),
        ]) as Array<{ lastLogin: Date, loginCount: number }>;

    /*  // If the user has never logged in before, we don't want to send them a message
        // TODO: This is a hack, we should be able to check if the user is new
        if (loginInfo) {
            const today = new Date();
            today.setHours(0,0,0,0);
    
            if (loginInfo.lastLogin > today) {
                this.getLogger().log('User has already logged in today');
                return;
            }
        } */

        await persistence.createWithAssociations({
            loginCount: 1,
            lastLogin: new Date(),
        }, [
            new RocketChatAssociationRecord(RocketChatAssociationModel.USER, user.id),
            new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'loginInfo'),
        ]);

        const tip = getRandomTip();
        const blocks = modify.getCreator().getBlockBuilder();

        // For future self: get user's language and translate accordingly
        await sendDirectMessage(read, modify, user, tipOfTheDay.replace('%s', tip.message));

        // Send a 2nd message to avoid size limitations of blocks
        if (tip.image) {
            blocks.addImageBlock({ imageUrl: tip.image, altText: 'Tip of the Day' });
            await sendDirectMessage(read, modify, user, '', blocks);
        }

        await persistence.updateByAssociations([
            new RocketChatAssociationRecord(RocketChatAssociationModel.USER, user.id),
            new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'loginInfo'),
        ], {
            loginCount: loginInfo.loginCount + 1,
            lastLogin: new Date(),
        });
    }

    public async executePostRoomUserJoined(context: IRoomUserJoinedContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify): Promise<void> {
        if (context.room.type !== RoomType.DIRECT_MESSAGE) {
            return;
        }

        const tip = getRandomTip();
        const blocks = modify.getCreator().getBlockBuilder();

        if (tip.image) {
            blocks.addImageBlock({ imageUrl: tip.image, altText: 'Tip of the Day' });
        }

        // For future self: get user's language and translate accordingly
        await sendDirectMessage(read, modify, context.joiningUser, tipOfTheDay.replace('%s', tip.message), blocks);
    }
}

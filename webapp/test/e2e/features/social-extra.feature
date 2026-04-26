@social
Feature: Social extra coverage

  Scenario: User can see a friend in the friend list
    Given I am logged in as "alice"
    And my profile has these friends:
      | username |
      | bob      |
    When I go to my profile page
    Then I should see "bob" in my friend list

  Scenario: User can accept a pending friend request
    Given I am logged in as "alice"
    And my profile has these pending friend requests:
      | username |
      | charlie  |
    When I go to my profile page
    And I accept the friend request from "charlie"
    Then "charlie" should appear in my friend list

  Scenario: User can open a friend profile
    Given I am logged in as "alice"
    And my profile has these friends:
      | username |
      | bob      |
    And the profile for "bob" exists
    When I go to my profile page
    And I open the profile of friend "bob"
    Then I should be on the profile page of "bob"

  Scenario: User sees already-friends error when sending duplicate request
    Given I am logged in as "alice"
    And the social search for "bob" returns these users:
      | username | realName |
      | bob      | Bob      |
    And sending a friend request to "bob" says they are already friends
    When I go to the social page
    And I search for "bob" in social
    And I send a friend request to "bob" from social
    Then I should see a social request error
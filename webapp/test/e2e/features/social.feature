Feature: Social and friend list
  As a logged in user
  I want to search users, send friend requests and manage my friend list
  So that I can interact with other players

  Background:
    Given I am logged in as "alice"

  Scenario: Search users from the social page
    Given the social search for "bo" returns these users:
      | username | realName     | email            |
      | bob      | Bob Stone    | bob@example.com  |
      | borja    | Borja Gomez  | borja@test.com   |
    When I go to the social page
    And I search for "bo" in social
    Then I should see "bob" in the social results
    And I should see "borja" in the social results

  Scenario: Send a friend request from social results
    Given the social search for "bob" returns these users:
      | username | realName   | email           |
      | bob      | Bob Stone  | bob@example.com |
    And sending a friend request to "bob" succeeds
    When I go to the social page
    And I search for "bob" in social
    And I send a friend request to "bob" from social
    Then I should see the friend request as sent for "bob" in social

  Scenario: Accept a pending friend request from my profile
    Given my profile has these pending friend requests:
      | username |
      | bob      |
    And my profile has these friends:
      | username |
    When I go to my profile page
    And I accept the friend request from "bob"
    Then "bob" should appear in my friend list

  Scenario: View existing friends in my profile
    Given my profile has these pending friend requests:
      | username |
    And my profile has these friends:
      | username |
      | bob      |
      | carol    |
    When I go to my profile page
    Then I should see "bob" in my friend list
    And I should see "carol" in my friend list

  Scenario: Open a friend's profile from the friend list
    Given my profile has these pending friend requests:
      | username |
    And my profile has these friends:
      | username |
      | bob      |
    And the profile for "bob" exists
    When I go to my profile page
    And I open the profile of friend "bob"
    Then I should be on the profile page of "bob"